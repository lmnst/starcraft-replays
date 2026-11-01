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
    }
'''
    needle='\tvoid next_frame() {\n\t\t++st.current_frame;\n\t\tprocess_frame();\n\t\tprocess_triggers();\n\t}'
    if needle not in text:raise RuntimeError('Unexpected pinned OpenBW next_frame source')
    text=text.replace(needle,trace+'\n'+needle.replace('\n\t}', '\n\t\tunified_trace_frame();\n\t}'),1)
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
