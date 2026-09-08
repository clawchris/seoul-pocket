import {json} from '../_lib/http.js';
/** Unknown /api/* paths answer JSON 404 instead of falling through to the HTML shell. */
export async function onRequest(){return json({error:'No such API route.'},404);}
