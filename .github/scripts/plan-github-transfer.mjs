import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const MAX_REQUEST_BYTES=1024*1024;
export const MAX_TREE_ENTRIES=100;
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');

// Plan only. No network access, credentials, branch updates or uploads.
export function planTransfer({repository,baseTree,changes,availableShas=[],readBlob,maxBytes=MAX_REQUEST_BYTES}) {
  if(!repository || !baseTree)throw new Error('Repository and base tree are required.');
  if(!Number.isSafeInteger(maxBytes)||maxBytes<512||maxBytes>MAX_REQUEST_BYTES)throw new Error('Request budget must be between 512 bytes and 1 MiB.');
  const known=new Set(availableShas),seen=new Set(),uploads=[],blocked=[],entries=[];
  for(const change of changes) {
    const {path,sha,mode='100644'}=change;
    if(!path||path.includes('\0'))throw new Error('Invalid repository path.');
    entries.push({path,mode,type:'blob',sha:sha??null});
    if(!sha||seen.has(sha))continue;
    seen.add(sha);
    if(known.has(sha))continue;
    const data=readBlob(sha);
    let content,encoding;
    try {content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(data);encoding='utf-8';}
    catch {content=data.toString('base64');encoding='base64';}
    const requestBytes=bytes({repository_full_name:repository,content,encoding});
    const record={sha,path,rawBytes:data.length,encoding,requestBytes};
    if(requestBytes>maxBytes)blocked.push(record);else uploads.push(record);
  }
  const treeBatches=[];
  let current=[];
  const treeBytes=items=>bytes({repository_full_name:repository,base_tree_sha:baseTree,tree_elements:items});
  for(const entry of entries) {
    if(current.length&&(current.length>=MAX_TREE_ENTRIES||treeBytes([...current,entry])>maxBytes)) {
      treeBatches.push({requestBytes:treeBytes(current),entries:current});current=[];
    }
    if(treeBytes([entry])>maxBytes)throw new Error(`Tree entry exceeds request budget: ${entry.path}`);
    current.push(entry);
  }
  if(current.length)treeBatches.push({requestBytes:treeBytes(current),entries:current});
  return {repository,baseTree,maxRequestBytes:maxBytes,changedPaths:entries.length,
    reusedBlobs:[...seen].filter(sha=>known.has(sha)).length,uploads,blocked,treeBatches,
    ready:blocked.length===0};
}

const git=(args,encoding='utf8')=>execFileSync('git',args,{encoding,maxBuffer:128*1024*1024});
function tree(ref) {
  return git(['ls-tree','-r','-z',ref]).split('\0').filter(Boolean).map(record=>{
    const tab=record.indexOf('\t'),[mode,type,sha]=record.slice(0,tab).split(' ');
    return {mode,type,sha,path:record.slice(tab+1)};
  });
}
export async function main(argv=process.argv.slice(2)) {
  const options={head:'HEAD',available:[]};
  for(let i=0;i<argv.length;i+=2) {
    const key=argv[i],value=argv[i+1];
    if(!['--base','--head','--available-ref','--repository','--output'].includes(key)||!value||value.startsWith('-'))throw new Error(`Invalid argument: ${key}`);
    if(key==='--available-ref')options.available.push(value);else options[key.slice(2)]=value;
  }
  if(!options.base||!options.repository)throw new Error('Usage: --base <commit> --repository <owner/repo> [--head <commit>] [--available-ref <verified-remote-commit>] [--output <file>]');
  // Resolve to object IDs before passing user-supplied refs to diff/tree commands.
  const commit=ref=>git(['rev-parse','--verify',`${ref}^{commit}`]).trim();
  const base=commit(options.base),head=commit(options.head),available=options.available.map(commit);
  const next=new Map(tree(head).map(entry=>[entry.path,entry]));
  const changed=git(['diff','--name-only','--no-renames','-z',base,head]).split('\0').filter(Boolean);
  const changes=changed.map(path=>next.get(path)||{path,sha:null});
  if(changes.some(entry=>entry.type&&entry.type!=='blob'))throw new Error('Submodule transfers require a separate plan.');
  const baseTree=git(['rev-parse',`${base}^{tree}`]).trim();
  const plan=planTransfer({repository:options.repository,baseTree,changes,
    availableShas:[base,...available].flatMap(ref=>tree(ref).filter(entry=>entry.type==='blob').map(entry=>entry.sha)),
    readBlob:sha=>git(['cat-file','blob',sha],null)});
  plan.baseCommit=base;plan.headCommit=head;plan.availableCommits=available;
  if(options.output)await writeFile(options.output,JSON.stringify(plan,null,2)+'\n');
  console.log(JSON.stringify({ready:plan.ready,changedPaths:plan.changedPaths,reusedBlobs:plan.reusedBlobs,
    uploads:plan.uploads.length,treeRequests:plan.treeBatches.length,
    largestRequestBytes:Math.max(0,...plan.uploads.map(item=>item.requestBytes),...plan.treeBatches.map(item=>item.requestBytes)),
    blocked:plan.blocked},null,2));
  if(!plan.ready)process.exitCode=1;
  return plan;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {await main();}catch(error){console.error(error.message);process.exitCode=1;}
}
