#!/usr/bin/env bash
set -euo pipefail
exports="['_main','_ui_resize','_replay_get_value','_replay_set_value','_player_get_value','_load_replay','_malloc','_free','_ui_set_screen_center','_ui_set_screen_center_manual','_ui_get_screen_pos','_ui_force_static_redraw']"
em++ -std=c++14 -I openbw/ -I sdl/ -ferror-limit=2 -O3 --bind \
  -D USE_DL_PREFIX -DMSPACES -DFOOTERS -g1 \
  -s ASM_JS=1 -s USE_SDL=2 -s TOTAL_MEMORY=201326592 -s INVOKE_RUN=0 \
  -s USE_SDL_IMAGE=2 -s SDL2_IMAGE_FORMATS="['png']" -s USE_SDL_MIXER=2 \
  -s DISABLE_EXCEPTION_CATCHING=1 -s ASSERTIONS=1 -s ABORTING_MALLOC=0 \
  -s EXPORTED_FUNCTIONS="$exports" -o openbw.html \
  openbw/ui/sdl2.cpp openbw/ui/gfxtest.cpp dlmalloc/malloc.c
