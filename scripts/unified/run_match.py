"""Run one isolated native match and require simulation-identical replay output."""
import argparse,hashlib,json,os,shutil,subprocess,time
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--root',type=Path,required=True)
parser.add_argument('--id',required=True)
parser.add_argument('--candidate',type=Path,required=True)
parser.add_argument('--opponent',default='Steamhammer')
parser.add_argument('--opponent-module',type=Path,required=True)
parser.add_argument('--opponent-data',type=Path,required=True)
parser.add_argument('--map',type=Path,required=True)
parser.add_argument('--seed',type=int,required=True)
parser.add_argument('--frames',type=int,default=86400)
parser.add_argument('--timeout',type=int,default=1200)
parser.add_argument('--port',type=int,default=28114)
parser.add_argument('--windows',action='store_true')
args=parser.parse_args()
root=args.root.resolve();shared=root.parent
out=root/'runs'/args.id
out.mkdir(parents=True,exist_ok=False)
lib=root/'build/bwapi/lib'
def runtime_path(path):
    return 'Z:'+str(path).replace('/','\\') if args.windows else str(path)
env={k:v for k,v in os.environ.items() if not k.startswith(('OPENBW_','BWAPI_CONFIG_','STARBENCH_','UNIFIED_TRACE_'))}
env.update(HOME=str(root/'home'),TMPDIR=str(root/'tmp'),LD_LIBRARY_PATH=str(lib),
    OPENBW_ENABLE_UI='0',OPENBW_MPQ_PATH=str(shared/'runtime/mpq'),OPENBW_MATCH_SEED=str(args.seed),
    OPENBW_LAN_MODE='TCP',OPENBW_TCP_LISTEN_HOSTNAME='127.0.0.1',OPENBW_TCP_CONNECT_HOSTNAME='127.0.0.1',
    OPENBW_TCP_LISTEN_PORT=str(args.port),OPENBW_TCP_CONNECT_PORT=str(args.port),
    BWAPI_CONFIG_AUTO_MENU__AUTO_MENU='LAN',BWAPI_CONFIG_AUTO_MENU__GAME_TYPE='MELEE',
    BWAPI_CONFIG_AUTO_MENU__AUTO_RESTART='OFF',BWAPI_CONFIG_AUTO_MENU__RACE='Protoss',
    BWAPI_CONFIG_STARCRAFT__SPEED_OVERRIDE='0',BWAPI_CONFIG_STARCRAFT__SOUND='OFF',
    BWAPI_CONFIG_AUTO_MENU__MAP=str(args.map),BWAPI_CONFIG_AI__TOURNAMENT=str(root/'build/libReferee.so'),
    STARBENCH_FRAME_CAP=str(args.frames))
if args.windows:
    prefix=out/'wineprefix'
    subprocess.run(['cp','-a','--reflink=auto',str(shared/'shared-manifest/baseline-v1/wine-template'),str(prefix)],check=True)
    env.update(WINEPREFIX=str(prefix),WINEDEBUG='-all',WINEDLLOVERRIDES='winemenubuilder.exe=d;mscoree=d;mshtml=d',
        TMP=runtime_path(root/'tmp'),TEMP=runtime_path(root/'tmp'),XDG_CACHE_HOME=str(root/'cache'),XDG_CONFIG_HOME=str(root/'cache'),
        OPENBW_MPQ_PATH=runtime_path(shared/'runtime/mpq'),BWAPI_CONFIG_AUTO_MENU__MAP=runtime_path(args.map),
        BWAPI_CONFIG_AI__TOURNAMENT=runtime_path(shared/'runtime/engines/stock/ProbeReferee.dll'))
processes=[];logs=[];start=time.monotonic()
try:
    for side,module in ((1,args.candidate),(2,args.opponent_module)):
        work=out/f'player{side}'
        if args.windows and side==2:
            shutil.copytree(args.opponent_data/'bwapi-data',work/'bwapi-data')
        for directory in ('AI','read','write'):(work/'bwapi-data'/directory).mkdir(parents=True,exist_ok=True)
        shutil.copyfile(shared/'runtime/bwapi.ini',work/'bwapi-data/bwapi.ini')
        if side==2 and not args.windows:
            for config in args.opponent_data.glob('*.json'):shutil.copyfile(config,work/'bwapi-data/AI'/config.name)
            cache=shared/'runtime/runtimes'/args.opponent/'bwapi-data/AI/bwta'
            if cache.exists():shutil.copytree(cache,work/'bwapi-data/AI/bwta')
        local=dict(env,BWAPI_CONFIG_AI__AI=runtime_path(module),BWAPI_CONFIG_AUTO_MENU__CHARACTER_NAME=f'compat{side}',
            BWAPI_CONFIG_AUTO_MENU__SAVE_REPLAY='game.rep',UNIFIED_TRACE_PATH=runtime_path(work/'state.trace'))
        log=(out/f'player{side}.log').open('wb');logs.append(log)
        launcher=([str(shared/'tools/wine-11.0-amd64-wow64/bin/wine'),str(root/'build/windows/BWAPILauncher.exe')] if args.windows else [str(root/'build/bwapi/bin/BWAPILauncher')])
        processes.append(subprocess.Popen(launcher,cwd=work,env=local,stdout=log,stderr=subprocess.STDOUT))
        if side==1:time.sleep(.6)
    while any(p.poll() is None for p in processes):
        if any(p.poll() not in (None,0) for p in processes) or time.monotonic()-start>args.timeout:break
        time.sleep(.2)
finally:
    forced=[]
    for side,process in enumerate(processes,1):
        if process.poll() is None:forced.append(side);process.kill()
        process.wait()
    for log in logs:log.close()

def events(side):
    path=out/f'player{side}/referee.jsonl'
    return [json.loads(line) for line in path.read_text(errors='replace').splitlines() if line.startswith('{')] if path.exists() else []

side_events=[events(side) for side in (1,2)]
ends=[[e for e in values if e['event']=='end'] for values in side_events]
caps=[[e for e in values if e['event']=='cap'] for values in side_events]
issues=[]
if forced:issues.append('forced_stop')
if len(processes)!=2 or any(p.returncode!=0 for p in processes):issues.append('match_exit')
if not all(ends):issues.append('missing_natural_end')
if any(caps):issues.append('frame_cap')
if all(ends) and ends[0][-1]['winner']==ends[1][-1]['winner']:issues.append('outcome_disagreement')

replay=out/'player1/game.rep'
check=None
if replay.exists() and not issues:
    check_env=dict(env,UNIFIED_TRACE_PATH=str(out/'replay.trace'))
    check=json.loads(subprocess.check_output([str(root/'build/replay-check'),str(shared/'runtime/mpq')+'/',str(replay)],env=check_env,text=True,timeout=300))
    def trace(path):return {int(frame):value for frame,value in (line.split() for line in path.read_text().splitlines())}
    match_trace=trace(out/'player1/state.trace');other_trace=trace(out/'player2/state.trace');replay_trace=trace(out/'replay.trace')
    mismatches=[frame for frame,value in replay_trace.items() if match_trace.get(frame)!=value]
    peer_mismatches=[frame for frame,value in other_trace.items() if frame in match_trace and match_trace[frame]!=value]
    coverage=bool(replay_trace) and len(replay_trace)==check['frame']
    if mismatches:issues.append('replay_state_mismatch')
    if peer_mismatches:issues.append('peer_state_mismatch')
    if not coverage:issues.append('incomplete_trace')
    check.update(compared_frames=len(replay_trace),first_mismatch=mismatches[0] if mismatches else None,
        peer_first_mismatch=peer_mismatches[0] if peer_mismatches else None,coverage_complete=coverage)
else:issues.append('replay_not_validated')

result={'id':args.id,'opponent':args.opponent,'map':args.map.name,'requested_seed':args.seed,
    'wall_seconds':round(time.monotonic()-start,3),'exit_codes':[p.returncode for p in processes],
    'forced_stop_sides':forced,'ends':ends,'caps':caps,'replay_check':check,'issues':issues,
    'passed':not issues,'natural_end':bool(all(ends) and not any(caps) and not forced),
    'outcome':('win' if ends[0][-1]['winner'] else 'loss') if all(ends) else 'unknown',
    'replay_sha256':hashlib.sha256(replay.read_bytes()).hexdigest() if replay.exists() else None,
    'candidate_sha256':hashlib.sha256(args.candidate.read_bytes()).hexdigest(),
    'opponent_sha256':hashlib.sha256(args.opponent_module.read_bytes()).hexdigest()}
result['starts']=[[e for e in values if e['event']=='start'] for values in side_events]
result['openbw_revision']='4b046d5f65302b10cb0a745f0fecd37ec85b20a8'
result['engine_sha256']=hashlib.sha256((root/('build/windows/OpenBWData.dll' if args.windows else 'build/bwapi/lib/libOpenBWData.so')).read_bytes()).hexdigest()
(out/'result.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2),flush=True)
raise SystemExit(0 if result['passed'] else 1)
