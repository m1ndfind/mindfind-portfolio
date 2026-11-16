'use strict';
const projects=[{name:'Leaf Studio',kind:'Услуги / студия озеленения',description:'Лендинг услуги: понятное предложение, варианты озеленения и переход к подбору решения.',src:'demos/leaf.html'},{name:'Mono Coffee',kind:'Локальный бизнес / кофейня',description:'Сайт кофейни с атмосферной подачей и меню напитков. Нажмите «Посмотреть меню» внутри макета.',src:'demos/mono.html'},{name:'Form Digital',kind:'Цифровой продукт / лендинг',description:'Презентация продукта: возможности, визуальный акцент и понятное действие для посетителя.',src:'demos/form.html'}];
const $=s=>document.querySelector(s);
const dialog=$('#project-dialog');
let opener=null;
document.querySelectorAll('[data-open]').forEach(button=>{
 button.addEventListener('click',()=>{
  const project=projects[Number(button.dataset.open)];
  if(!project)return;
  opener=button;
  $('#dialog-title').textContent=project.name;
  $('#large-frame').title='Интерактивный макет '+project.name;
  $('#large-frame').src=project.src;
  dialog.showModal();
 });
});
$('#close-project').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{
 $('#large-frame').src='about:blank';
 opener?.focus({preventScroll:true});
});
dialog.addEventListener('click',e=>{
 const r=dialog.getBoundingClientRect();
 if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();
});
// Sandboxed demos have an opaque origin; validate the sending frame.
window.addEventListener('message',e=>{
 if(dialog.open&&e.source===$('#large-frame').contentWindow&&e.data?.type==='mindfind:close-demo')dialog.close();
});
$('#brief').addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(e.target);const text='Заявка на сайт\nИмя: '+d.get('name')+'\nКонтакт: '+d.get('contact')+'\nЗадача: '+d.get('task');try{await navigator.clipboard.writeText(text);$('#status').textContent='Заявка скопирована. Вставьте её в сообщение разработчику.';}catch{let field=$('#copy-fallback');if(!field){field=document.createElement('textarea');field.id='copy-fallback';field.className='fallback-copy';field.setAttribute('aria-label','Заявка для ручного копирования');e.target.append(field);}field.value=text;field.focus();field.select();$('#status').textContent='Автокопирование недоступно. Скопируйте выделенный текст ниже.';}});

$('#brief').addEventListener('input',e=>{
 if(!e.target.name)return;
 $('#status').textContent='';
 $('#copy-fallback')?.remove();
});
