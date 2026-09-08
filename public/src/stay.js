import {text} from './domain.js';
export function cleanStay(value){
 const v=value||{},lat=v.lat===''||v.lat==null?null:Number(v.lat),lng=v.lng===''||v.lng==null?null:Number(v.lng);
 if(!text(v.addressKo,500))throw new Error('Add the Korean accommodation address.');
 if((lat==null)!==(lng==null)||(lat!=null&&(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<31.43||lat>44.35||lng<122.37||lng>132)))throw new Error('Enter both stay coordinates within Korea, or leave both blank.');
 return {name:text(v.name,140),addressKo:text(v.addressKo,500),addressEn:text(v.addressEn,500),lat,lng,pin:text(v.pin,100),room:text(v.room,100),wifi:text(v.wifi,150),wifiPassword:text(v.wifiPassword,150),phone:text(v.phone,60),note:text(v.note,2000)};
}
export function mergeStayAddress(current,supplied){const address=cleanStay(supplied);return cleanStay({...current,addressKo:address.addressKo,addressEn:address.addressEn,lat:address.lat,lng:address.lng});}
