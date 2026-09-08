import {json} from '../_lib/http.js';
export async function onRequestGet(){return json({ok:true,service:'seoul-pocket',version:'0.1.0'});}
