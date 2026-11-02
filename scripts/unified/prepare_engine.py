"""Apply the shared match/replay build instrumentation to a pinned OpenBW tree."""
from pathlib import Path
import sys

root=Path(sys.argv[1])
core=root/'bwgame.h'
text=core.read_text()
if 'void unified_trace_frame()' not in text:
    text=text.replace('#include <functional>','#include <functional>\n#include <fstream>\n#include <iomanip>')
    trace=r'''
    void unified_trace_frame() {
        const char* path=std::getenv("UNIFIED_TRACE_PATH");
        if (!path) return;
        static std::ofstream output(path);
        uint64_t hash=14695981039346656037ull;
        auto add=[&](uint64_t value) {for(int i=0;i<8;i++){hash^=uint8_t(value);hash*=1099511628211ull;value>>=8;}};
        add(st.current_frame);add(st.lcg_rand_state);
        for(int owner=0;owner<8;owner++) {
            add(owner);add(st.current_minerals[owner]);add(st.current_gas[owner]);
            for(int race=0;race<3;race++){add(st.supply_used[owner][race].raw_value);add(st.supply_available[owner][race].raw_value);}
            for(const unit_t* unit:ptr(st.player_units[owner])) {
                add(get_unit_id_32(unit).raw_value);add((int)unit->unit_type->id);
                add(unit->position.x);add(unit->position.y);add(unit->hp.raw_value);add(unit->shield_points.raw_value);
                add((int)unit->order_type->id);add(unit->order_state);add(unit->remaining_build_time);
                add(unit->order_target.pos.x);add(unit->order_target.pos.y);add(get_unit_id_32(unit->order_target.unit).raw_value);
            }
            add(0xffffffffffffffffull);
        }
        output<<std::dec<<st.current_frame<<' '<<std::hex<<std::setw(16)<<std::setfill('0')<<hash<<'\n';
        output.flush();
    }
'''
    needle='\tvoid next_frame() {\n\t\t++st.current_frame;\n\t\tprocess_frame();\n\t\tprocess_triggers();\n\t}'
    if needle not in text:raise RuntimeError('Unexpected pinned OpenBW next_frame source')
    text=text.replace(needle,trace+'\n'+needle.replace('\n\t}', '\n\t\tunified_trace_frame();\n\t}'),1)
    core.write_text(text)

# The archived matches ran on a VS2017 x86 OpenBWData.dll (sha256 a7aa50b8...0918c04)
# that did not wrap heading - 64 before the gas exit table lookup. Headings in
# [-128, -65] read the 64 entries stored before direction_table in that DLL
# (korean.h tables in .data, no relocations). Replays of those matches only stay
# in sync when the same offsets are used here.
text=core.read_text()
if 'msvc_gas_exit_offset' not in text:
    needle='\t\txy offset = to_xy(direction_xy(heading - 64_dir, 32));'
    if needle not in text:raise RuntimeError('Unexpected pinned OpenBW gas exit source')
    before_table='{1322672107, 1430148260}, {1504008366, 1649631472}, {1731617494, -2110428843}, {-1716414912, 1345100253}, {1430541139, -100575364}, {-100507048, 1718314210}, {1874946013, 1948413935}, {-1978174408, 65535}, {1414632504, 1466324486}, {1637506888, 1884842830}, {2109436077, 1500154517}, {1671594283, -2143455480}, {1481936042, 1773888557}, {1578195861, -100438417}, {1363969385, 1495946224}, {1632329760, 1819306886}, {2065591536, -2100002610}, {-1867477562, -100362063}, {1873044679, 1694786705}, {1410355534, -1978771681}, {1752588639, 1977350661}, {2104589138, 1476825114}, {-2122356276, -1879013078}, {1350080569, 1504467287}, {-1878039915, 1633524522}, {-1781108103, 1514559329}, {1653235188, 1694131373}, {1826776951, 1915514174}, {2016703542, -2102558857}, {-1743286821, 1463964196}, {1917347711, -1935051549}, {-1844342874, 65535}, {1366005290, 1665946605}, {1426345833, 1700225174}, {1837067419, 1929212492}, {-1987610089, 1601014941}, {1895395214, 1628340648}, {1347375039, 1917280833}, {2112388039, -1873969175}, {-1709598803, 1466600630}, {1739611763, -1974107123}, {1528189984, 1591893603}, {1703108362, -2059566918}, {-1772382839, 1392856904}, {1393513229, 1425691782}, {1577277187, 1654349846}, {1666540209, 1826748934}, {1974562150, -2132903886}, {-2099347153, -2068675487}, {-1995274099, -1830121461}, {-1684956931, 1723096645}, {1880188637, -100175354}, {1383944181, 1632853866}, {1780049747, 1960996610}, {-2006419096, -1731752839}, {-1706846012, 65535}, {2048873665, -1963497133}, {-1733784502, 1602001326}, {1974624939, -2002028882}, {-1774022529, 1597788985}, {1825333189, 1969386444}, {2068215179, -1717730562}, {-1875095985, 1330990603}, {1494176678, 1714446024}'
    helper='''
	xy msvc_gas_exit_offset(direction_t heading) const {
		static const int32_t before_direction_table[64][2] = {%s};
		int raw = (int)heading.raw_value - 64;
		if (raw >= -128) return to_xy(direction_xy(heading - 64_dir, 32));
		auto scale = [](int32_t v) {return (int32_t)((uint32_t)v * 32u) >> 8;};
		auto& e = before_direction_table[raw + 192];
		return {scale(e[0]), scale(e[1])};
	}
'''%before_table
    anchor='\tbool find_gas_exit_position(const unit_t* u, const unit_t* gas, xy& pos, direction_t& heading) {'
    if anchor not in text:raise RuntimeError('Unexpected pinned OpenBW gas exit source')
    text=text.replace(anchor,helper+'\n'+anchor,1).replace(needle,'\t\txy offset = msvc_gas_exit_offset(heading);',1)
    core.write_text(text)

sync=root/'sync.h';text=sync.read_text()
needle='st.lcg_rand_state = rand_state;'
replacement='if (const char* value = std::getenv("OPENBW_MATCH_SEED")) rand_state = static_cast<uint32_t>(std::strtoul(value, nullptr, 10));\n\t\t\t'+needle
if replacement not in text:sync.write_text(text.replace(needle,replacement,1))

ui=root/'ui/gfxtest.cpp'
if ui.exists():
    text=ui.read_text()
    text=text.replace('size_t tell() const {\n\t\tfile_pointer;','size_t tell() const {\n\t\treturn file_pointer;')
    if 'extern "C" void ui_set_screen_center(' not in text:
        wrappers=r'''
extern "C" void ui_set_screen_center(int x,int y) {
    if (!m) return;
    m->ui.screen_pos={x-int(m->ui.view_width)/2,y-int(m->ui.view_height)/2};
}
extern "C" void ui_set_screen_center_manual(int x,int y) {ui_set_screen_center(x,y);}
extern "C" int ui_get_screen_pos(int axis) {return m?(axis?m->ui.screen_pos.y:m->ui.screen_pos.x):0;}
extern "C" void ui_force_static_redraw() {if(m)m->ui.update();}
'''
        text=text.replace('extern "C" double replay_get_value(int index) {',wrappers+'\nextern "C" double replay_get_value(int index) {',1)
        text=text.replace('\tcase 14:\n\t\treturn (double)m->ui.apm.at(player).current_apm;', '\tcase 14:\n\t\treturn (double)m->ui.apm.at(player).current_apm;\n\tcase 15:\n\t\treturn m->ui.game_st.start_locations.at(player).x;\n\tcase 16:\n\t\treturn m->ui.game_st.start_locations.at(player).y;')
    ui.write_text(text)
print('Prepared unified OpenBW source:',root)
