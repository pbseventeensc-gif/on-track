const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {proofUrl,createReceiptPhotoHandler}=require('../lib/receipt-photo.cjs');
const url='https://firebasestorage.googleapis.com/v0/b/ontrack-fccb8.firebasestorage.app/o/proofs_sj%2Fproof.jpg?alt=media&token=12345678-1234-1234-1234-123456789abc';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(body){this.body=body;return this;}});

test('receipt proxy accepts only token-bearing proof URLs in the Wtrack storage buckets',()=>{
 assert.equal(proofUrl(url),url);
 for(const candidate of [url.replace('firebasestorage.googleapis.com','127.0.0.1'),url.replace('https:','http:'),url.replace('ontrack-fccb8.firebasestorage.app','other.appspot.com'),url.replace('proofs_sj','avatars'),url.replace('&token=','&ignored='),url+'&redirect=http://localhost',url.replace('.com/v0','.com:8080/v0')]) assert.equal(proofUrl(candidate),null);
});
test('receipt proxy returns actual bytes with canvas-safe headers and refuses redirects upstream',async()=>{
 const bytes=Buffer.from('a proof image');let fetchOptions;
 const handler=createReceiptPhotoHandler(async (source,options)=>{assert.equal(source,url);fetchOptions=options;return new Response(bytes,{headers:{'content-type':'image/jpeg'}});});
 const res=response();await handler({method:'GET',query:{source:url}},res);
 assert.equal(res.code,200);assert.deepEqual(res.body,bytes);assert.equal(res.headers['Access-Control-Allow-Origin'],'*');assert.equal(res.headers['Content-Type'],'image/jpeg');assert.equal(fetchOptions.redirect,'error');
});
test('receipt proxy reports unavailable, invalid and oversized images instead of returning HTML',async()=>{
 for(const [upstream,code] of [[new Response('missing',{status:404}),502],[new Response('<html>',{headers:{'content-type':'text/html'}}),422],[new Response('large',{headers:{'content-type':'image/jpeg','content-length':String(11*1024*1024)}}),413]]){
  const res=response();await createReceiptPhotoHandler(async()=>upstream)({method:'GET',query:{source:url}},res);assert.equal(res.code,code);
 }
 const res=response();await createReceiptPhotoHandler(()=>{throw Error('must not fetch');})({method:'GET',query:{source:'http://localhost'}},res);assert.equal(res.code,400);
});
test('receipt photo selection uses this delivery only, supports legacy fields and skips placeholders',()=>{
 const source=fs.readFileSync('kurir.html','utf8'),context=vm.createContext({URL,window:{location:{protocol:'https:',origin:'https://wtrack.test'}}});
 vm.runInContext(source.slice(source.indexOf('    function getReceiptProofSources('),source.indexOf('    function loadSafeCanvasImage(')),context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.getReceiptProofSources({proofSJUrl:'data:image/svg+xml,placeholder',proofPhotoSj:url,proofPhotoItems:['https://images.test/item.jpg'],proofPhotoUrl:'https://images.test/a.jpg,https://images.test/b.jpg'}))),{sj:url,barang:'https://images.test/item.jpg'});
 assert.equal(context.getReceiptProofSources(null).sj,'');
 assert.equal(context.receiptPhotoSource(url),'https://wtrack.test/api/receipt-photo?source='+encodeURIComponent(url));
 assert.equal(context.receiptPhotoSource('data:image/jpeg;base64,abc'),'data:image/jpeg;base64,abc');
});
