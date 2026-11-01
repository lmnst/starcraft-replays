#include <iostream>
#include <iomanip>
#include <map>
#include "replay.h"

int main(int argc,char** argv) {
    if(argc!=3) return 2;
    bwgame::replay_player game;
    game.init(static_cast<const char*>(argv[1]));
    game.load_replay_file(argv[2]);
    while(!game.is_done()) game.next_frame();
    auto& state=game.st();
    std::cout<<"{\"frame\":"<<state.current_frame<<",\"players\":[";
    bool first_player=true;
    for(int owner=0;owner<8;owner++) {
        if(game.replay_st.player_name[owner].empty())continue;
        if(!first_player)std::cout<<',';first_player=false;
        int workers=0,army=0,supply=0,total=0;
        std::map<int,int> units;
        for(auto u:bwgame::ptr(state.player_units[owner])) {
            units[(int)u->unit_type->id]++;
            if(game.funcs().ut_worker(u)) workers++;
            else if(!game.funcs().ut_building(u))army++;
        }
        for(int race=0;race<3;race++){supply+=state.supply_used[owner][race].raw_value;total+=state.supply_available[owner][race].raw_value;}
        std::cout<<"{\"name\":"<<std::quoted(game.replay_st.player_name[owner])<<",\"minerals\":"<<state.current_minerals[owner]<<",\"gas\":"<<state.current_gas[owner]<<",\"workers\":"<<workers<<",\"army\":"<<army<<",\"supply_used\":"<<supply<<",\"supply_total\":"<<total<<",\"units\":{";
        bool first_unit=true;for(auto item:units){if(!first_unit)std::cout<<',';first_unit=false;std::cout<<'"'<<item.first<<"\":"<<item.second;}
        std::cout<<"}}";
    }
    std::cout<<"]}\n";
}
