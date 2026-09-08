import {escapeHTML} from './domain.js';
export const e=escapeHTML;
const paths={
 weather:'M5 16a4 4 0 0 1 0-8 6 6 0 0 1 11 0 4 4 0 1 1 1 8H5 M8 19v2 M13 19v2',
 swap:'M3 7h17 M16 3l4 4-4 4 M21 17H4 M8 13l-4 4 4 4',
 home:'M3 10 12 3l9 7v11h-6v-7H9v7H3z',
 pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
 speak:'M4 4h16v12H9l-5 4V4z M8 8h8 M8 12h5',
 tools:'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
 trip:'M5 6h14v15H5z M9 6V3h6v3 M9 10v7 M15 10v7',
 plus:'M12 5v14 M5 12h14', arrow:'M4 12h16 M14 6l6 6-6 6',
 star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z',
 food:'M5 3v7c0 2 4 2 4 0V3 M7 3v18 M19 3c-5 2-5 10 0 10V3v18',
 lock:'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3 M12 14v3',
 close:'M6 6l12 12 M6 18L18 6', check:'M4 12l5 5L20 6',
 volume:'M4 9h4l5-4v14l-5-4H4z M17 8q5 4 0 8',
 search:'M15 15l6 6 M17 10A7 7 0 1 1 3 10a7 7 0 0 1 14 0Z',
 train:'M6 3h12v14H6z M6 10h12 M9 17l-3 4 M15 17l3 4 M9 14h.01 M15 14h.01',
 won:'M3 5l4 14 5-14 5 14 4-14 M3 11h18 M3 14h18',
 download:'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
 heart:'M12 21S2 14 2 8a5 5 0 0 1 10-3 5 5 0 0 1 10 3c0 6-10 13-10 13z',
 clock:'M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
 shield:'M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6z M8 12l3 3 5-6',
 external:'M14 3h7v7 M21 3 10 14 M10 3H3v18h18v-7',
 photo:'M3 3h18v18H3z M3 17l6-6 4 4 3-3 5 5 M16 7h.01'
};
export function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.pin}"/></svg>`;}
export function button(label,action,cls='',extra=''){return `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;}
export function external(label,url,cls='link-button'){return `<a class="${cls}" href="${e(url)}" target="_blank" rel="noopener noreferrer">${label}${icon('external')}</a>`;}
export function field(label,name,value='',type='text',extra=''){return `<label>${label}<input name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;}
export function textarea(label,name,value='',extra=''){return `<label>${label}<textarea name="${name}" rows="3" ${extra}>${e(value)}</textarea></label>`;}
export function select(label,name,options,value){return `<label>${label}<select name="${name}">${options.map(([v,l])=>`<option value="${e(v)}" ${v===value?'selected':''}>${e(l)}</option>`).join('')}</select></label>`;}
let toastTimer;
export function toast(message){const box=document.querySelector('#toast');box.textContent=message;box.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('visible'),6500);}
export function errorMessage(error){return error instanceof Error?error.message:'Something went wrong. Your saved data has not been intentionally cleared.';}

/** Small finite choices use visible radio chips instead of hidden dropdown menus. */
export function choice(label,name,options,value){return `<fieldset class="choice-field"><legend>${e(label)}</legend><div class="choice-options">${options.map(([v,l])=>`<label class="choice-option"><input type="radio" name="${e(name)}" value="${e(v)}" ${v===value?'checked':''}><span>${e(l)}</span></label>`).join('')}</div></fieldset>`;}
