import {b64,unb64} from './crypto.js';
/** Decode and re-encode uploads locally: bounds dimensions and discards original metadata. */
export async function preparePhoto(file){
 if(!file)return null;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG, or WebP. For HEIC, export a JPEG or use a screenshot.');
 if(file.size>15*1024*1024)throw new Error('Choose an image smaller than 15 MB.');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;await img.decode();
  if(!img.width||!img.height||img.width*img.height>60000000)throw new Error('This image is too large to process safely.');
  const scale=Math.min(1,1200/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image processing is unavailable.');ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.78));if(!blob||blob.size>1024*1024)throw new Error('This photo is too detailed. Try a smaller image.');
  return {id:crypto.randomUUID(),blob,width:canvas.width,height:canvas.height};
 }finally{URL.revokeObjectURL(url);}
}
export async function serializePhotos(s){return {...s,photos:await Promise.all(s.photos.map(async p=>({...p,blob:undefined,mime:p.blob.type,data:b64(new Uint8Array(await p.blob.arrayBuffer()))})))};}
export function deserializePhotos(s){
 if(!Array.isArray(s?.photos)||s.photos.length>1000)throw new Error('Invalid backup photos.');
 return {...s,photos:s.photos.map(p=>({...p,blob:new Blob([unb64(p.data)],{type:p.mime}),data:undefined}))};
}
export function downloadFile(content,name,type='application/json'){
 const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
