import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve('public');
const portFlag=process.argv.indexOf('--port');
const port=Number(process.env.PORT||(portFlag>=0?process.argv[portFlag+1]:3000));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png'};
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    let path=resolve(root,'.'+decodeURIComponent(url.pathname));
    if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
    if((await stat(path)).isDirectory())path=resolve(path,'index.html');
    const data=await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  } catch {res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');}
}).listen(port,'0.0.0.0',()=>console.log(`Atlas preview is listening on port ${port}`));
