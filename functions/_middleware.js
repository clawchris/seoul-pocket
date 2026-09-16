/** Applies to functions, because Pages _headers does not secure Function responses. */
export async function onRequest(context){
 try{
  const response=await context.next(),headers=new Headers(response.headers);
  const supplied=response.headers.get('Cache-Control');headers.set('Cache-Control',supplied&&/^(public|private), max-age=\d+(, immutable)?$/.test(supplied)?supplied:'no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');
  headers.set('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
  return new Response(response.body,{status:response.status,headers});
 }catch{return new Response(JSON.stringify({error:'Service unavailable. Local trip data is unchanged.'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
}
