import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import sharp from 'sharp'
import { createApi } from './api.mjs'
import { template, normalizeSkin, parts, faces } from './skin.mjs'
async function server(options, run) {
  const api = createApi(options)
  const instance = createServer((req,res) => api(req,res,() => {res.writeHead(404);res.end()}))
  await new Promise(resolve => instance.listen(0,'127.0.0.1',resolve))
  try { await run(`http://127.0.0.1:${instance.address().port}`) }
  finally { await new Promise(resolve => instance.close(resolve)) }
}
test('atlas contains all six opaque cuboids and no outer-layer pixels', async () => {
  const {data,info} = await sharp(await normalizeSkin(await template())).raw().toBuffer({resolveWithObject:true})
  assert.equal(info.width,64); assert.equal(info.height,64)
  let count=0
  for(let i=3;i<data.length;i+=4) if(data[i]) count++
  assert.equal(count,parts.flatMap(faces).reduce((sum,[,,w,h]) => sum+w*h,0))
  assert.equal(data[(40*64+10)*4+3],0)
  assert.equal(data[(55*64+37)*4+3],255)
})
test('reject malformed atlas instead of stretching it', async () => {
  const image=await sharp({create:{width:128,height:64,channels:3,background:'red'}}).png().toBuffer()
  await assert.rejects(normalizeSkin(image),/неквадратную/)
})
test('missing key produces actionable response', async () => {
  await server({getSettings:()=>({key:'',model:'test'})},async url => {
    assert.deepEqual(await (await fetch(url+'/api/status')).json(),{configured:false,model:'test'})
    const response=await fetch(url+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
    assert.equal(response.status,503)
  })
})
test('generation sends template server-side and returns PNG; cross-origin rejected', async () => {
  const image=(await template()).toString('base64')
  let requests=0
  await server({getSettings:()=>({key:'secret-test-value',model:'test-model'}),fetchImpl:async (url,options)=> {
    requests++
    assert.equal(options.headers['x-goog-api-key'],'secret-test-value')
    assert.ok(JSON.parse(options.body).contents[0].parts[1].inlineData.data)
    return new Response(JSON.stringify({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:image}}]}}]}),{status:200})
  }},async url=>{
    const options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:'Лесной рыцарь',style:'survival'})}
    assert.equal((await fetch(url+'/api/generate',{...options,headers:{...options.headers,Origin:'https://unrelated.example'}})).status,403)
    assert.equal(requests,0)
    const response=await fetch(url+'/api/generate',options)
    assert.equal(response.status,200)
    const result=await response.json()
    assert.ok(result.image.startsWith('data:image/png;base64,'))
    assert.equal(JSON.stringify(result).includes('secret-test-value'),false)
    assert.equal((await sharp(Buffer.from(result.image.split(',')[1],'base64')).metadata()).width,64)
    assert.equal(requests,1)
  })
})
test('quota failures do not leak payload or trigger retries', async()=>{
  let requests=0
  await server({getSettings:()=>({key:'test',model:'test'}),fetchImpl:async()=>{requests++;return new Response('private provider details',{status:429})}},async url=>{
    const response=await fetch(url+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:'Knight'})})
    assert.equal(response.status,502)
    assert.match((await response.json()).error,/квота/)
    assert.equal(requests,1)
  })
})
