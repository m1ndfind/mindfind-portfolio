export function setupProjects() {
  const dialog = document.querySelector('#project-dialog');
  if (typeof dialog.showModal !== 'function') return;
  const title = dialog.querySelector('h2');
  const frame = dialog.querySelector('iframe');
  const loading = dialog.querySelector('.demo-loading');
  let opener;
  const links = Array.from(document.querySelectorAll('[data-project]'));
  const devices = dialog.querySelectorAll('[data-device]');
  const canvas = dialog.querySelector('.demo-canvas');
  let device = 'desktop';
  let current = 0;

  function displayProject(link) {
    current = links.indexOf(link);
    const name = link.closest('.project').querySelector('h3').textContent;
    title.textContent = name;
    frame.title = 'Интерактивное демо ' + name;
    loading.textContent = 'Загружается демо…';
    document.querySelector('#full-demo').href = link.href;
    frame.src = link.href;
  }

  function fitDevice() {
    if (!dialog.open || !canvas.clientWidth) return;
    const width = device === 'desktop' ? 1280 : Math.min(canvas.clientWidth, 390);
    const scale = Math.min(1, canvas.clientWidth / width);
    const height = canvas.clientHeight / scale;
    frame.style.setProperty('--device-width', width + 'px');
    frame.style.setProperty('--device-scale', scale);
    frame.style.setProperty('--device-height', height + 'px');
  }
  function selectDevice(value) {
    device = value;
    for (const button of devices) button.setAttribute('aria-pressed', String(button.dataset.device === device));
    fitDevice();
  }
  new ResizeObserver(fitDevice).observe(canvas);
  for (const button of devices) button.addEventListener('click', () => selectDevice(button.dataset.device));
  dialog.querySelector('#next-project').addEventListener('click', () => {
    displayProject(links[(current + 1) % links.length]);
  });
  function openProject(link, source = link) {
    opener = source;
    displayProject(link);
    dialog.showModal();
    selectDevice(matchMedia('(max-width: 760px)').matches ? 'phone' : 'desktop');
  }
  for (const link of links) {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openProject(link);
    });
  }
  for (const shot of document.querySelectorAll('.gallery-open')) {
    shot.addEventListener('click', () => {
      const link = shot.closest('.project').querySelector('[data-project]');
      openProject(link, shot);
    });
  }
  frame.addEventListener('load', () => { loading.textContent = ''; });
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    loading.textContent = '';
    frame.removeAttribute('src');
    opener?.focus({ preventScroll: true, focusVisible: true });
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  window.addEventListener('message', (event) => {
    if (dialog.open && event.source === frame.contentWindow && event.data?.type === 'mindfind:close-demo') {
      dialog.close();
    }
  });
}

export function setupBrief() {
  const form = document.querySelector('#brief');
  const status = document.querySelector('#status');
  const button=form.querySelector('#copy-brief');
  const fields=Array.from(form.querySelectorAll('[required]'));
  const errors={name:'Введите ваше имя.',contact:'Укажите Telegram или email для ответа.',task:'Кратко опишите задачу.'};
  form.noValidate=true;
  function validate(field){
    const valid=Boolean(field.value.trim());
    field.setAttribute('aria-invalid',String(!valid));
    document.getElementById(field.name+'-error').textContent=valid?'':errors[field.name];
    return valid;
  }
  let revision = 0;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const current = ++revision;
    const invalid=fields.filter(field=>!validate(field));
    if(invalid.length){invalid[0].focus();return;}
    const data = new FormData(form);
    for(const field of fields)data.set(field.name,field.value.trim());
    const text = ['Заявка на сайт', 'Имя: ' + data.get('name'),
      'Контакт: ' + data.get('contact'), 'Задача: ' + data.get('task')].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      if (revision !== current) return;
      form.querySelector('.fallback-copy')?.remove();
      button.dataset.copied='';
      button.querySelector('span').textContent='Заявка скопирована';
      button.querySelector('b').textContent='✓';
      status.textContent='Заявка скопирована. Теперь вы можете вставить текст в сообщение и отправить его самостоятельно.';
      form.dispatchEvent(new Event('brief-copied',{bubbles:true}));
    } catch {
      if (revision !== current) return;
      resetButton();
      let field = form.querySelector('.fallback-copy');
      if (!field) {
        field = document.createElement('textarea');
        field.className = 'fallback-copy';
        field.setAttribute('aria-label', 'Текст заявки для ручного копирования');
        field.rows = 5;
        field.readOnly = true;
        status.after(field);
      }
      field.value = text;
      status.textContent = 'Скопируйте выделенный текст вручную.';
      field.focus();
      field.select();
    }
  });
  function resetButton(){
    delete button.dataset.copied;
    button.querySelector('span').textContent='Скопировать заявку';
    button.querySelector('b').textContent='↗';
  }
  form.addEventListener('input', event => {
    if(event.target.getAttribute('aria-invalid')==='true')validate(event.target);
    resetButton();
    revision++;
    status.textContent = '';
    form.querySelector('.fallback-copy')?.remove();
  });
  document.querySelector('#copy-brief').disabled = false;
}
