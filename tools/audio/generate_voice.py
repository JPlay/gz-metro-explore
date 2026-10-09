#!/usr/bin/env python3
"""Offline Bailian voice generation. Credentials are read ONLY from environment.
Never logs responses, request headers, signed URLs, environment values, or errors.
Run with DASHSCOPE_API_KEY and optional DASHSCOPE_HOST inherited by this process.
"""
import os, json, time, hashlib, subprocess, tempfile, pathlib, concurrent.futures
import requests
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/audio'
VOICE=OUT/'voice'
SR=24000
STATIONS=[('gyq','公园前','Gongyuanqian'),('njs','农讲所','Peasant Movement Institute'),('lsly','烈士陵园',"Martyrs' Park"),('dsk','东山口','Dongshankou')]
# 播报风格（VOICE_STYLE 环境变量或 --style 参数选择；默认 cosy = 已确认的 B 风格，全部片段按此重制）
#   legacy : 原设置。普通话 Serena + 旧指令 + optimize_instructions=True（官方说明：会改写指令以“提升自然度和表现力”）
#   flat   : 标准报站。普通话仍是 Serena，但指令改成“平稳平直、不带情绪”，且关闭 optimize_instructions；
#            粤语 Kiki（instruct 模型不支持 Kiki，已实测 400）和英语 Jennifer（qwen3-tts-flash，无指令）不变 → 只有普通话片段需要重制
#   cosy   : CosyVoice 播报音色。普通话 / 英语 cosyvoice-v2 longxiaobai_v2（官方特质“沉稳播报女”），粤语 cosyvoice-v3-flash longjiayi_v3（“知性粤语女”）→ 全部重制
STYLES={
 'legacy':{'langs':{'zh':('qwen3-tts-instruct-flash','Serena','Chinese'),'yue':('qwen3-tts-flash','Kiki','Chinese'),'en':('qwen3-tts-flash','Jennifer','English')},
           'instruction':'平静清晰的城市地铁报站女声，中等语速，字正腔圆，站名后短暂停顿，客观播报，声音成熟稳定。','optimize':True},
 'flat':{'langs':{'zh':('qwen3-tts-instruct-flash','Serena','Chinese'),'yue':('qwen3-tts-flash','Kiki','Chinese'),'en':('qwen3-tts-flash','Jennifer','English')},
         'instruction':'标准地铁报站播音，录音广播式的女声。语调平稳平直，句尾不上扬，几乎没有高低起伏；吐字清晰，字正腔圆；语速适中且均匀；不带任何情绪和感情色彩，不热情、不亲切、不夸张，客观中性。','optimize':False},
 'cosy':{'langs':{'zh':('cosyvoice-v2','longxiaobai_v2','Chinese'),'yue':('cosyvoice-v3-flash','longjiayi_v3','Chinese'),'en':('cosyvoice-v2','longxiaobai_v2','English')},
         'instruction':None,'optimize':False},
}
def _style_arg():
    import sys
    for i,a in enumerate(sys.argv):
        if a=='--style' and i+1<len(sys.argv):return sys.argv[i+1]
        if a.startswith('--style='):return a.split('=',1)[1]
    return os.environ.get('VOICE_STYLE','cosy')
STYLE=_style_arg()
if STYLE not in STYLES:raise SystemExit('unknown VOICE_STYLE '+STYLE+' (legacy | flat | cosy)')
LANGS=STYLES[STYLE]['langs']
INSTRUCTION=STYLES[STYLE]['instruction']
OPTIMIZE=STYLES[STYLE]['optimize']
JOBS=[]

def add(key,texts,label):
    for lang,text in zip(LANGS,texts):
        model,voice,language=LANGS[lang]
        JOBS.append({'id':'voice.'+key+'.'+lang,'file':'voice/'+key.replace('.','-')+'-'+lang+'.mp3','group':'voice','label':label,'lang':lang,'text':text,'model':model,'voice':voice,'language_type':language})

for sid,zh,en in STATIONS:
    transfer='，可换乘六号线' if sid=='dsk' else ''
    en_transfer=', the interchange with Line Six' if sid=='dsk' else ''
    add('next.'+sid,[f'下一站，{zh}{transfer}。',f'下一站，{zh}{transfer}。',f'The next station is {en}{en_transfer}.'],zh+' · 下一站')
    add('arrive.'+sid,[f'列车即将到达{zh}站，请小心列车与站台之间的空隙。',f'列车即将到达{zh}站，请小心列车同站台之间的空隙。',f'The train is arriving at {en}. Please mind the gap between the train and the platform.'],zh+' · 到站')
    add('welcome.'+sid,[f'欢迎光临{zh}站。请排队候车，先下后上。',f'欢迎光临{zh}站。请排队候车，先落后上。',f'Welcome to {en} station. Please line up for the train. Let the passengers get off first before you get on.'],zh+' · 站台欢迎')

for d,zh,en in [('up','广州东站','Guangzhou Dongzhan'),('down','西塱','Xilang')]:
    add('destination.'+d,[f'本次列车终点站为{zh}。',f'本次列车终点站为{zh}。',f'The destination of this train is {en}.'],zh+' · 终点方向')
    for platform in [1,2]:
        num=['一','二'][platform-1]
        add(f'platform.{d}.{platform}',[f'{num}站台，{zh}方向列车即将进站。',f'{num}站台，{zh}方向列车即将进站。',f'The train bound for {en} is approaching at Platform {platform}.'],f'{platform}站台 · '+zh+'方向')
    add('terminal.'+d,[f'下一站是本次列车的终点站，{zh}。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐广州地铁。',f'下一站系本次列车的终点站，{zh}。请全部乘客带齐行李物品在本站落车，欢迎再次乘坐广州地铁。',f'The next station is {en}, the terminal of this journey. Please take all your belongings and leave the train. Thank you for travelling on Guangzhou Metro.'],zh+' · 终点站')

add('doorsClosing',['车门即将关闭，请注意安全，谨防被夹。','车门即将关闭，请注意安全，谨防被夹。','The doors are closing. Please stand clear of the doors.'],'车门即将关闭')
add('gap',['请小心列车与站台之间的空隙。','请小心列车同站台之间的空隙。','Please mind the gap between the train and the platform.'],'请小心空隙')
add('transfer.gyq',['请从列车前进方向的右门下车，中部楼梯换乘二号线。','请由列车前进方向的右门落车，中部楼梯换乘二号线。','Please exit the train to the right. To transfer to Line Two, please take the stairs in the middle of the platform.'],'公园前 · 中部楼梯换乘2号线')
add('transfer.dsk',['可换乘六号线。','可换乘六号线。','You can transfer to Line Six.'],'东山口 · 换乘6号线')
add('exit.left',['请从列车前进方向的左门下车。','请由列车前进方向的左门落车。','Please exit the train to the left.'],'左门下车')
add('exit.right',['请从列车前进方向的右门下车。','请由列车前进方向的右门落车。','Please exit the train to the right.'],'右门下车')



# Verified operator safety guidance; bilingual reconstruction, not licensed PA masters.
SAFETY=[
 ('escalator','请站稳，并握紧黑色扶手带，请勿在扶梯口处停留。','请企稳，握紧黑色扶手带，请勿在扶梯口停留。','扶梯 · 站稳握扶手',['concourse','platform'],'historical PA wording documented in 2017 news; still consistent with operator safety guide'),
 ('care','小心照顾同行的老人和小孩。','请小心照顾同行的老人同小朋友。','同行 · 照顾老人小孩',['concourse','platform'],'operator safety guide, escalator general guidance 1'),
 ('walk','站内通行时请注意地面状况，严禁奔跑、追逐。','在车站行路请留意地面情况，请勿奔跑同追逐。','站内 · 请勿奔跑追逐',['concourse'],'operator safety guide, station passage 4'),
 ('queue','请不要越出黄色安全线，请按地面标识排队候车。','请勿越出黄色安全线，请按地面标识排队候车。','站台 · 黄线后排队',['platform'],'historical staff PA wording documented in 2017 news; operator guide waiting 2'),
 ('psd','手或身体请勿扶靠屏蔽门、安全门。','请勿用手或者身体挨住屏蔽门、安全门。','站台 · 请勿扶靠屏蔽门',['platform'],'operator safety guide, waiting 3; slash rendered as spoken punctuation'),
 ('lights','灯闪、铃响时请勿上下列车。','灯闪、铃响的时候，请勿上落列车。','站台 · 灯闪铃响勿上落',['platform'],'operator safety guide, boarding 1')
]
for key,zh,yue,label,zones,evidence in SAFETY:
    for lang,text in [('zh',zh),('yue',yue)]:
        model,voice,language=LANGS[lang]
        JOBS.append({'id':'voice.safety.'+key+'.'+lang,'file':'voice/safety-'+key+'-'+lang+'.mp3','group':'voice','label':label,'lang':lang,'text':text,'model':model,'voice':voice,'language_type':language,'purpose':'station-safety','zones':zones,'wordingEvidence':evidence,'source':'https://apppax.gzmtr.cn/DNSFile/wechat/guide/ccaq_index.html','translation':lang=='yue'})


# 新网络（1、2 号线全部车站）的片段由 js/data/phrases.js 导出：node tools/audio/export_jobs.mjs → voice-jobs.json
EXTRA=ROOT/'tools/audio/voice-jobs.json'
if EXTRA.exists():
    known={j['id']:j for j in JOBS}
    for j in json.loads(EXTRA.read_text()):
        # phrases.js 是文字的唯一来源：同 id 的旧片段（如英文站名改用拼音）按导出的文字重新生成
        if j['id'] in known: known[j['id']]['text']=j['text']; continue
        model,voice,language=LANGS[j['lang']]
        JOBS.append({'id':j['id'],'file':j['file'],'group':'voice','label':j['id'][6:],'lang':j['lang'],'text':j['text'],'model':model,'voice':voice,'language_type':language})


if STYLE!='legacy':
    for j in JOBS:
        if 'instruct' in j['model']:j['instructions']=INSTRUCTION;j['optimize_instructions']=OPTIMIZE


def ffmpeg(data,path):
    # NamedTemporaryFile lives outside the served workspace. Only audio bytes.
    with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
        tmp.write(data);tmp.flush()
        p=subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-i',tmp.name,'-af','silenceremove=start_periods=1:start_duration=0.025:start_threshold=-48dB,highpass=f=145,lowpass=f=6500,loudnorm=I=-19:TP=-2.5:LRA=6,afade=t=in:d=0.018','-ar','24000','-ac','1','-codec:a','libmp3lame','-b:a','64k','-map_metadata','-1',str(path)],capture_output=True)
        if p.returncode:raise RuntimeError('Audio encoding failed')

def synthesize(job,key,host):
    """One API call → raw WAV bytes (Qwen-TTS or CosyVoice HTTP). Never logs URLs, headers or responses."""
    if job['model'].startswith('cosyvoice'):
        endpoint=host+'/services/audio/tts/SpeechSynthesizer'
        payload={'model':job['model'],'input':{'text':job['text'],'voice':job['voice'],'format':'wav','sample_rate':SR}}
    else:
        endpoint=host+'/services/aigc/multimodal-generation/generation'
        payload={'model':job['model'],'input':{'text':job['text'],'voice':job['voice'],'language_type':job['language_type']}}
        if 'instruct' in job['model']:payload['input'].update(instructions=job.get('instructions',INSTRUCTION),optimize_instructions=job.get('optimize_instructions',OPTIMIZE))
    for attempt in range(4):
        try:
            r=requests.post(endpoint,headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'},json=payload,timeout=(15,100))
            if r.status_code!=200:
                if r.status_code in [429,500,502,503]:time.sleep(2**attempt);continue
                raise RuntimeError('Synthesis rejected (HTTP '+str(r.status_code)+')')
            j=r.json();url=j.get('output',{}).get('audio',{}).get('url')
            if not url:raise RuntimeError('No generated audio')
            # Do not forward Authorization to an object storage download.
            if url.startswith('http://'):url='https://'+url[7:]
            download=requests.get(url,timeout=(15,60));download.raise_for_status()
            return download.content
        except Exception:
            if attempt==3:raise RuntimeError('Synthesis failed for '+job['id']) from None
            time.sleep(2**attempt)

def fingerprint(job):return hashlib.sha256(json.dumps(job,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
def cache_entry(job):return {'fp':fingerprint(job),'style':STYLE,'model':job['model'],'voice':job['voice']}
def is_cached(job):
    # voice-cache.json：id → {fp, style, model, voice}；旧格式（只有指纹字符串）一律视为需要重制
    e=CACHE.get(job['id'])
    return (OUT/job['file']).exists() and isinstance(e,dict) and e.get('fp')==fingerprint(job)

def generate(job,key,host):
    path=OUT/job['file']; path.parent.mkdir(parents=True,exist_ok=True)
    if is_cached(job):
        return job['id'],CACHE[job['id']],True
    ffmpeg(synthesize(job,key,host),path)
    return job['id'],cache_entry(job),False


def seq(prefix):return ['voice.'+prefix+'.'+lang for lang in LANGS]

def manifest():
    old=json.loads((OUT/'manifest.json').read_text()) if (OUT/'manifest.json').exists() else {'version':1,'assets':[]}
    assets=[a for a in old['assets'] if a.get('group')!='voice']
    for j in JOBS:
        a=dict(j)
        p=OUT/j['file']
        if not p.exists():continue  # 只把真正存在的文件写进清单，缺的由游戏用 Web Speech 朗读
        if p.exists():
            r=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(p)],capture_output=True,text=True)
            a['duration']=round(float(r.stdout),3);a['bytes']=p.stat().st_size
        assets.append(a)
    routes={}
    for sid,zh,en in STATIONS:
        for d in ['up','down']:
            next_seq=seq('destination.'+d)+seq('next.'+sid)
            next_seq+=seq('transfer.gyq') if sid=='gyq' else seq('exit.left')
            routes[sid+'_'+d]={'station':sid,'dir':1 if d=='up' else -1,'destination':'广州东站' if d=='up' else '西塱','announcements':{'next':next_seq,'arrive':seq('arrive.'+sid),'welcome':seq('welcome.'+sid)}}
    result={'version':2,'voiceStyle':STYLE,'languages':['zh','yue','en'],'languageNames':{'zh':'普通话','yue':'粤语','en':'英语'},'assets':assets,'routes':routes,'announcements':{'doorsClosing':seq('doorsClosing'),'gap':seq('gap')},'notes':['四站双方向使用预合成段落组合，普通话→粤语→英语。','到站、关门等扩展三语便于儿童体验；实际车厢部分安全提示仅普通话。','站台编号必须由场景传入，默认上行1、下行2是场景约定，非每座真实站台的核验结果。']}
    result['doorDuration']=1.25;result['gateDuration']=.6
    result['stationSafety']={key:{'ids':['voice.safety.'+key+'.zh','voice.safety.'+key+'.yue'],'zones':zones,'evidence':evidence} for key,zh,yue,label,zones,evidence in SAFETY}
    (OUT/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')

CACHE={}
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--style',default=STYLE,choices=list(STYLES));parser.add_argument('--manifest-only',action='store_true');parser.add_argument('--only',default='');args=parser.parse_args()
    if args.manifest_only:manifest();raise SystemExit(0)
    key=os.environ.get('DASHSCOPE_API_KEY')
    if not key:raise SystemExit('DASHSCOPE_API_KEY is missing from the process environment')
    host=os.environ.get('DASHSCOPE_HOST','dashscope.aliyuncs.com').rstrip('/')
    if not host.startswith('https://'):host='https://'+host
    if not host.endswith('/api/v1'):host+='/api/v1'
    stamp=ROOT/'tools/audio/voice-cache.json'
    if stamp.exists():CACHE=json.loads(stamp.read_text())
    jobs=[j for j in JOBS if not args.only or args.only in j['id']]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures=[pool.submit(generate,j,key,host) for j in jobs]
        for n,f in enumerate(concurrent.futures.as_completed(futures),1):
            try:
                jid,entry,cached=f.result();CACHE[jid]=entry
                stamp.write_text(json.dumps(CACHE,indent=2)+'\n')
                print(f'{n}/{len(jobs)} {jid} '+('cached' if cached else 'ready'),flush=True)
            except RuntimeError as ex:print(str(ex),flush=True);raise SystemExit(1)
    manifest()
    print('Voice manifest ready',flush=True)
