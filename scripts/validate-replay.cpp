// Replay container decoding follows OpenBW replay.h (source in THIRD_PARTY.md).
// CRC, decompression, action envelopes and embedded CHK are checked here.
// This is structural validation, not a guarantee of simulation compatibility.
#include "../vendor/openbw/data_loading.h"
#include <fstream>
#include <iostream>
#include <vector>
#include <stdexcept>
using bytes = std::vector<uint8_t>;
struct Reader {
 const bytes& b; size_t p=0;
 uint32_t u32(){ if(p+4>b.size())throw std::runtime_error("truncated integer");uint32_t v=0;for(int i=0;i<4;++i)v|=uint32_t(b[p++])<<(8*i);return v; }
 bytes block(size_t n){
  if(n>64*1024*1024)throw std::runtime_error("section exceeds 64 MB");
  uint32_t crc=u32(),segments=u32();if(segments!=(n+8191)/8192)throw std::runtime_error("invalid segment count");
  bytes out(n);size_t o=0;
  for(uint32_t i=0;i<segments;++i){size_t input=u32(),output=std::min(size_t(8192),n-o);if(!input||input>output||p+input>b.size())throw std::runtime_error("invalid compressed segment");
   if(input==output)std::copy(b.begin()+p,b.begin()+p+input,out.begin()+o);
   else bwgame::data_loading::decompress(const_cast<uint8_t*>(b.data()+p),input,out.data()+o,output);
   p+=input;o+=output;
  }
  uint32_t actual=0xffffffff;for(auto c:out){actual^=c;for(int k=0;k<8;++k)actual=(actual>>1)^((actual&1)?0xedb88320:0);}
  if(crc!=actual)throw std::runtime_error("section CRC mismatch");return out;
 }
 uint32_t scalar(){auto x=block(4);return uint32_t(x[0])|(uint32_t(x[1])<<8)|(uint32_t(x[2])<<16)|(uint32_t(x[3])<<24);}
};
int main(int argc,char**argv){
 try{
  if(argc!=2)throw std::runtime_error("expected a replay path");
  std::ifstream f(argv[1],std::ios::binary);if(!f)throw std::runtime_error("cannot open replay");bytes data((std::istreambuf_iterator<char>(f)),{});Reader r{data};
  if(r.scalar()!=0x53526572)throw std::runtime_error("unsupported replay identifier (requires 1.16.1)");
  auto header=r.block(633);uint32_t frames=uint32_t(header[1])|(uint32_t(header[2])<<8)|(uint32_t(header[3])<<16)|(uint32_t(header[4])<<24);
  if(!frames||frames>24*60*60*24)throw std::runtime_error("invalid replay duration");
  auto actions=r.block(r.scalar());Reader a{actions};uint32_t previous=0;
  while(a.p<actions.size()){auto frame=a.u32();if(frame<previous||frame>frames||a.p>=actions.size())throw std::runtime_error("invalid action frame");previous=frame;size_t length=actions[a.p++];if(a.p+length>actions.size())throw std::runtime_error("truncated action packet");a.p+=length;}
  auto map=r.block(r.scalar());Reader m{map};bool dimensions=false,version=false;
  // OpenBW's map reader stops at an oversized final chunk: some valid maps
  // contain editor metadata after their CHK chunks. Replay section CRC still
  // covers the entire map, including that trailing data.
  while(m.p+8<=map.size()){auto id=m.u32();auto n=m.u32();if(n>map.size()-m.p)break;if(id==0x204d4944&&n==4)dimensions=true;if(id==0x20524556&&n==2)version=true;m.p+=n;}
  if(!dimensions||!version)throw std::runtime_error("missing CHK dimensions/version");if(r.p!=data.size())throw std::runtime_error("unexpected trailing replay data");
  std::cout<<"{\"frames\":"<<frames<<",\"structure_valid\":true}"<<std::endl;
 }catch(const std::exception&e){std::cerr<<e.what()<<std::endl;return 1;}
}
