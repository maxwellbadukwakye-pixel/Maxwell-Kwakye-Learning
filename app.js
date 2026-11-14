const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
const installButton=$('#install-app');
let installPrompt=null;
if(installButton){
  installButton.hidden=false;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;installButton.textContent='Install app'});
  installButton.addEventListener('click',async()=>{
    if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return}
    const isApple=/iphone|ipad|ipod/i.test(navigator.userAgent);
    alert(isApple?'To install Kwakye Tech, tap Share, then Add to Home Screen.':'To install Kwakye Tech, open your browser menu and choose Install app or Add to Home screen.');
  });
  window.addEventListener('appinstalled',()=>{installButton.hidden=true});
}
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));
$('#year').textContent=new Date().getFullYear();
$('.theme-toggle').addEventListener('click',()=>{document.body.classList.toggle('dark');$('.theme-toggle').textContent=document.body.classList.contains('dark')?'☀':'☾';localStorage.setItem('kwakye-theme',document.body.classList.contains('dark')?'dark':'light')});
if(localStorage.getItem('kwakye-theme')==='dark'){document.body.classList.add('dark');$('.theme-toggle').textContent='☀'}
const nav=$('.nav'),menu=$('.menu-toggle');menu.addEventListener('click',()=>{nav.classList.toggle('open');menu.setAttribute('aria-expanded',nav.classList.contains('open'))});$$('.nav a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false')}));
const modal=$('#login-modal');$$('[data-login]').forEach(b=>b.addEventListener('click',()=>{modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}));$$('[data-close]').forEach(b=>b.addEventListener('click',closeModal));document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});function closeModal(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow=''}
$('#video-search').addEventListener('submit',e=>{e.preventDefault();const q=$('#video-query').value.trim();if(q)window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(q),'_blank','noopener,noreferrer')});$$('[data-query]').forEach(b=>b.addEventListener('click',()=>{const q=b.dataset.query;$('#video-query').value=q;window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(q),'_blank','noopener,noreferrer')}));

// Maxwell AI uses the site's private server endpoint; no API key is exposed in the browser.
const form=$('#chat-form'),input=$('#chat-input'),messages=$('#chat-messages'),mic=$('#voice-record'),voiceToggle=$('#voice-replies'),status=$('#voice-status');
let voiceReplies=true, recognition=null, recording=false;
const history=[];
function addMessage(text,kind='bot-message'){
  const node=document.createElement('div');node.className='message '+kind;node.textContent=text;messages.append(node);messages.scrollTop=messages.scrollHeight;return node;
}
function setStatus(text){if(status)status.textContent=text}
function deviceVoices(){
  const synth=window.speechSynthesis,voices=synth.getVoices();
  if(voices.length)return Promise.resolve(voices);
  return new Promise(resolve=>{
    let finished=false;
    const finish=()=>{if(finished)return;const loaded=synth.getVoices();if(loaded.length){finished=true;clearTimeout(timer);synth.removeEventListener?.('voiceschanged',finish);resolve(loaded)}};
    const timer=setTimeout(()=>{if(finished)return;finished=true;synth.removeEventListener?.('voiceschanged',finish);resolve(synth.getVoices())},1800);
    synth.addEventListener?.('voiceschanged',finish);
  });
}
const maleVoiceName=/(?:\bmale\b|\bman\b|\bdavid\b|\bdaniel\b|\bmark\b|\bguy\b|\bryan\b|\bjames\b|\bgeorge\b|\bmatthew\b|\baaron\b|\bfred\b|\bbrian\b|\bthomas\b|\boliver\b|\bliam\b|\bandrew\b|\beric\b|\broger\b|\bchristopher\b|\bsteffan\b|\bpaul\b|\bpeter\b|\barthur\b)/i;
function preferredVoice(voices){
  const english=voices.filter(v=>/^en(-|_|$)/i.test(v.lang));
  return english.find(v=>maleVoiceName.test(v.name))||english.find(v=>!/\bfemale\b/i.test(v.name))||english[0]||voices[0]||null;
}
function speechFriendlyText(text){
  return text
    .replace(/```[\s\S]*?```/g,' I’ve put the code in the written reply. ')
    .replace(/`([^`]+)`/g,'$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
    .replace(/https?:\/\/\S+/g,'')
    .replace(/^\s{0,3}#{1,6}\s/gm,'')
    .replace(/^\s*[-*+]\s+/gm,'')
    .replace(/[=+*#@^_~<>/\\{}\[\]$%|]/g,' ')
    .replace(/\s+([,.;:!?])/g,'$1')
    .replace(/\s{2,}/g,' ')
    .trim();
}
async function speak(text){
  if(!voiceReplies||!('speechSynthesis'in window))return;
  const synth=window.speechSynthesis;
  synth.cancel();
  const voice=preferredVoice(await deviceVoices());
  const utterance=new SpeechSynthesisUtterance(speechFriendlyText(text));utterance.lang='en-US';utterance.rate=.95;utterance.pitch=.9;
  if(voice)utterance.voice=voice;
  const explicitMale=!!voice&&maleVoiceName.test(voice.name);
  utterance.pitch=explicitMale?0.9:0.76;
  setStatus(explicitMale?'Speaking with a male English voice.':"Your phone doesn't list a male English voice, so I'm using its closest available voice. You can download or choose a male voice in your phone's text-to-speech settings.");
  synth.speak(utterance);
}
async function sendChat(text){
  const question=text.trim();if(!question)return;
  const suggestions=$('.suggestions',messages);if(suggestions)suggestions.remove();
  addMessage(question,'user-message');input.value='';input.focus();
  const pending=addMessage('Let me think that through…','bot-message is-typing');
  const send=$('#chat-form button[type="submit"]');if(send)send.disabled=true;
  try{
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,history:history.slice(-8)})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Maxwell AI is temporarily unavailable. Please try again in a moment.');
    const answer=typeof data.answer==='string'&&data.answer.trim()?data.answer.trim():'I’m sorry, I couldn’t form a clear answer. Could you ask that another way?';
    pending.classList.remove('is-typing');pending.textContent=answer;
    history.push({role:'user',content:question},{role:'assistant',content:answer});speak(answer);
  }catch(error){
    pending.classList.remove('is-typing');pending.textContent=error.message.includes('Failed to fetch')?'I can’t reach the learning assistant right now. Please check your internet connection and try again.':error.message;
  }finally{if(send)send.disabled=false;messages.scrollTop=messages.scrollHeight;}
}
form.addEventListener('submit',e=>{e.preventDefault();sendChat(input.value)});
$$('.suggestions button').forEach(b=>b.addEventListener('click',()=>sendChat(b.textContent)));
$('#clear-chat').addEventListener('click',()=>{history.length=0;if(window.speechSynthesis)window.speechSynthesis.cancel();messages.innerHTML='<div class="message bot-message">Hi! I’m Maxwell AI. Ask me a question about Excel, web development, Photoshop, or anything you’re learning.</div><div class="suggestions"><button>Help me with Excel</button><button>How do I make a website?</button><button>Explain Photoshop layers</button></div>';$$('.suggestions button',messages).forEach(b=>b.addEventListener('click',()=>sendChat(b.textContent)))});
if(voiceToggle){voiceToggle.setAttribute('aria-pressed','true');voiceToggle.addEventListener('click',()=>{voiceReplies=!voiceReplies;voiceToggle.setAttribute('aria-pressed',String(voiceReplies));voiceToggle.textContent=voiceReplies?'🔊 Voice replies on':'🔇 Voice replies off';if(!voiceReplies&&window.speechSynthesis)window.speechSynthesis.cancel();setStatus(voiceReplies?'Replies will be spoken aloud.':'Voice replies are off.')})}
if(mic){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){mic.disabled=true;mic.title='Voice recording is not supported by this browser';setStatus('Voice input is not available in this browser. You can type your question.');}
  else{
    recognition=new SpeechRecognition();recognition.lang='en-US';recognition.interimResults=true;recognition.continuous=false;
    recognition.onstart=()=>{recording=true;mic.classList.add('recording');mic.setAttribute('aria-pressed','true');mic.textContent='■';setStatus('Listening… Speak your question.')};
    recognition.onresult=e=>{let words='';for(let i=e.resultIndex;i<e.results.length;i++)words+=e.results[i][0].transcript;input.value=words.trim();if(e.results[e.results.length-1].isFinal){setStatus('I heard: '+words.trim());}};
    recognition.onerror=e=>{recording=false;mic.classList.remove('recording');mic.setAttribute('aria-pressed','false');mic.textContent='🎙';setStatus(e.error==='not-allowed'?'Please allow microphone access in your browser, then try again.':'I couldn’t hear that clearly. Tap the microphone and try again.')};
    recognition.onend=()=>{recording=false;mic.classList.remove('recording');mic.setAttribute('aria-pressed','false');mic.textContent='🎙';if(input.value.trim()){const heard=input.value.trim();setStatus('Sending your question…');sendChat(heard)}else setStatus('Tap the microphone and speak, or type your question.')};
    mic.addEventListener('click',()=>{if(recording)recognition.stop();else{input.value='';try{recognition.start()}catch{setStatus('Please wait a moment, then tap the microphone again.')}}});
  }
}
if('speechSynthesis'in window)window.speechSynthesis.getVoices();
