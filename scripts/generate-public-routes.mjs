#!/usr/bin/env node
/** Generate crawler-ready HTML and sitemap entries from approved public routes.
 * Canonical authority is read from js/app-config.js and cannot be overridden by
 * a deployment environment variable. Sitemap/canonical disagreement fails closed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const endpoint = String(process.env.PUBLIC_CONTENT_ENDPOINT || '').replace(/\/$/, '');
const anonKey = String(process.env.SUPABASE_ANON_KEY || '');
const config = await fs.readFile(path.join(root, 'js/app-config.js'), 'utf8');
const authority = config.match(/const\s+YWI_CANONICAL_ORIGIN\s*=\s*['"]([^'"]+)['"]/);
const configUpdated = config.match(/APP_CONFIG_UPDATED_AT:\s*['"](\d{4}-\d{2}-\d{2})['"]/);
const siteUrl = String(authority?.[1] || '').replace(/\/$/, '');
if (!endpoint || !/^https:\/\//i.test(siteUrl)) {
  console.error(!endpoint ? 'Missing PUBLIC_CONTENT_ENDPOINT. No route files were changed.' : 'Missing valid HTTPS YWI_CANONICAL_ORIGIN. No route files were changed.');
  process.exit(2);
}

const reserved = new Set(['api','archive','docs','icons','js','scripts','sql','supabase','index.html','style.css','favicon.ico','manifest.json','robots.txt','sitemap.xml','server-worker.js']);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safePath=(v='')=>{const p=`/${String(v).replace(/^\/+|\/+$/g,'')}`.replace(/^\/$/,'/');const r=p.split('/').filter(Boolean)[0]?.toLowerCase()||'';if(p==='/'||!/^\/[a-z0-9][a-z0-9\/-]*$/.test(p)||p.includes('..')||reserved.has(r))throw new Error(`Unsafe route path: ${v}`);return p;};
const safeUrl=(v='',fallback='')=>{const raw=String(v||fallback||'').trim();if(!raw)return fallback;try{const u=new URL(raw,siteUrl);return ['http:','https:'].includes(u.protocol)?u.href:fallback;}catch{return fallback;}};
const safeCanonical=(v='',fallback='/')=>{try{const base=new URL(siteUrl);const u=new URL(String(v||fallback),base);return u.origin===base.origin?u.href:new URL(fallback,base).href;}catch{return new URL(fallback,siteUrl).href;}};
const normalizedPath=(v='/')=>{const p=new URL(String(v||'/'),siteUrl).pathname.replace(/\/+$/,'');return p||'/';};
const validDate=(v='')=>/^\d{4}-\d{2}-\d{2}$/.test(String(v).slice(0,10))?String(v).slice(0,10):'';
function gitLastmod(file,fallback=''){
  try{
    const out=execFileSync('git',['log','-1','--format=%cs','--',file],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
    return validDate(out)||validDate(fallback);
  }catch{return validDate(fallback);}
}
const homeLastmod=gitLastmod('index.html',configUpdated?.[1]||'');
const inline=(v='')=>esc(v).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
function markdown(md=''){const out=[];let list='';const close=()=>{if(list){out.push(`</${list}>`);list='';}};for(const raw of String(md).split(/\r?\n/)){const line=raw.trim();if(!line){close();continue;}const h=line.match(/^(#{2,4})\s+(.+)$/);if(h){close();const n=Math.min(4,h[1].length);out.push(`<h${n}>${inline(h[2])}</h${n}>`);continue;}const b=line.match(/^[-*]\s+(.+)$/),n=line.match(/^\d+\.\s+(.+)$/);if(b||n){const next=b?'ul':'ol';if(list!==next){close();list=next;out.push(`<${list}>`);}out.push(`<li>${inline((b||n)[1])}</li>`);continue;}close();out.push(`<p>${inline(line)}</p>`);}close();return out.join('\n');}
function approvedHtml(raw=''){return String(raw).replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1\s*>/gi,'').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi,'').replace(/javascript:/gi,'');}
async function call(payload){const headers={'content-type':'application/json'};if(anonKey){headers.apikey=anonKey;headers.authorization=`Bearer ${anonKey}`;}const r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok)throw new Error(d?.error||`Public content request failed (${r.status}).`);return d;}
function canonicalForRoute(route){
  const routePath=safePath(route.route_path);
  const expected=new URL(routePath,`${siteUrl}/`);
  const raw=String(route.canonical_url||expected.href).trim();
  let supplied;
  try{supplied=new URL(raw,`${siteUrl}/`);}catch{throw new Error(`Invalid canonical URL for ${routePath}.`);}
  if(supplied.origin!==expected.origin||normalizedPath(supplied.href)!==normalizedPath(expected.href)||supplied.search||supplied.hash){
    throw new Error(`Canonical URL disagrees with approved route path ${routePath}.`);
  }
  return expected.href;
}
function validateSitemapEntry(entry){
  const routePath=safePath(entry.route_path);
  const expected=new URL(routePath,`${siteUrl}/`);
  let supplied;
  try{supplied=new URL(String(entry.canonical_url||expected.href),`${siteUrl}/`);}catch{throw new Error(`Invalid sitemap canonical for ${routePath}.`);}
  if(supplied.origin!==expected.origin||normalizedPath(supplied.href)!==normalizedPath(expected.href)||supplied.search||supplied.hash){
    throw new Error(`Sitemap canonical disagrees with route path ${routePath}.`);
  }
  const lastModified=validDate(entry.last_modified);
  if(entry.last_modified&&!lastModified) throw new Error(`Invalid sitemap lastmod for ${routePath}.`);
  if(lastModified&&lastModified>new Date().toISOString().slice(0,10)) throw new Error(`Future sitemap lastmod for ${routePath}.`);
  return {...entry,route_path:routePath,canonical_url:expected.href,last_modified:lastModified};
}
function schemaGraph(route,canonical){
  const label=route.service_name||route.location_name||route.h1_text||route.page_title;
  const description=route.meta_description||route.page_intro||'';
  return {
    '@context':'https://schema.org',
    '@graph':[
      {'@type':'WebPage','@id':`${canonical}#webpage`,url:canonical,name:route.page_title,description,inLanguage:'en-CA',isPartOf:{'@id':`${siteUrl}/#website`},breadcrumb:{'@id':`${canonical}#breadcrumb`}},
      {'@type':'Service','@id':`${canonical}#service`,name:route.service_name||route.h1_text,description,areaServed:route.location_name||'Southern Ontario',provider:{'@id':`${siteUrl}/#organization`},url:canonical,mainEntityOfPage:{'@id':`${canonical}#webpage`}},
      {'@type':'BreadcrumbList','@id':`${canonical}#breadcrumb`,itemListElement:[
        {'@type':'ListItem',position:1,name:'Home',item:`${siteUrl}/`},
        {'@type':'ListItem',position:2,name:label,item:canonical}
      ]}
    ]
  };
}
function pageHtml(route,visual){
  const canonical=canonicalForRoute(route);
  const image=safeUrl(visual?.public_url||visual?.source_url,'');
  const cta=String(route.primary_cta_path||'/#quote-intake');
  const safeCta=cta.startsWith('/')||cta.startsWith('#')?cta:'/#quote-intake';
  const body=approvedHtml(route.page_body_html||'')||markdown(route.page_body_markdown||'')||`<p>${esc(route.page_intro||'')}</p>`;
  const schema=JSON.stringify(schemaGraph(route,canonical)).replace(/</g,'\\u003c');
  const description=route.meta_description||route.page_intro||'';
  const imageAlt=visual?.alt_text||route.h1_text||route.page_title;
  return `<!doctype html>\n<html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(route.page_title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"><link rel="canonical" href="${esc(canonical)}"><link rel="stylesheet" href="/style.css"><meta property="og:locale" content="en_CA"><meta property="og:type" content="website"><meta property="og:title" content="${esc(route.page_title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}">${image?`<meta property="og:image" content="${esc(image)}"><meta property="og:image:alt" content="${esc(imageAlt)}">`:''}<meta name="twitter:card" content="${image?'summary_large_image':'summary'}"><meta name="twitter:title" content="${esc(route.page_title)}"><meta name="twitter:description" content="${esc(description)}">${image?`<meta name="twitter:image" content="${esc(image)}"><meta name="twitter:image:alt" content="${esc(imageAlt)}">`:''}<script type="application/ld+json" data-public-route-schema="1">${schema}</script><script src="/js/app-config.js"></script></head>\n<body class="public-route-mode static-public-route"><main id="publicRouteView" class="public-route-shell"><header class="public-route-header"><a href="/" class="public-route-brand"><span aria-hidden="true">YWI</span><strong>Yard Weasels Inc.</strong></a><a class="secondary" href="${esc(safeCta)}">Request a quote</a></header><article class="public-route-article"><nav class="public-route-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>${esc(route.service_name||route.location_name||'Service')}</span></nav><section class="public-route-hero"><div><span class="public-route-kicker">${esc(route.location_name||'Southern Ontario')}</span><h1>${esc(route.h1_text)}</h1><p>${esc(route.page_intro||route.meta_description||'')}</p><div class="public-route-hero-actions"><a class="primary" href="${esc(safeCta)}">Request a quote</a><a class="secondary" href="/#quote-intake">View contact form</a></div></div>${image?`<figure><img src="${esc(image)}" alt="${esc(imageAlt)}" width="${Number(visual?.pixel_width||1200)}" height="${Number(visual?.pixel_height||800)}" loading="eager" decoding="async"><figcaption>Approved service visual</figcaption></figure>`:`<div class="public-route-visual-placeholder" role="img" aria-label="Service image placeholder"><span aria-hidden="true">◇</span><strong>Service visual placeholder</strong><small>An approved, compressed, consent-cleared image will replace this placeholder.</small></div>`}</section><section class="public-route-proof"><strong>Local proof</strong><p>${esc(route.local_proof_hint||'')}</p></section><section class="public-route-content">${body}</section><section class="public-route-cta"><div><span>Ready to discuss the work?</span><h2>Request a clear quote and next-step plan</h2><p>Share the location, service need, timing, and any safety or access constraints.</p></div><a class="primary" href="${esc(safeCta)}">Start a request</a></section></article><footer class="public-route-footer"><span>Yard Weasels Inc. · Southern Ontario</span><a href="/">Home</a></footer></main></body></html>\n`;
}
function sitemapXml(entries){
  const rows=[{route_path:'/',canonical_url:`${siteUrl}/`,last_modified:homeLastmod},...entries];
  const unique=[...new Map(rows.map(r=>[safeCanonical(r.canonical_url,`${siteUrl}${r.route_path}`),r])).entries()];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map(([u,r])=>{const d=validDate(r.last_modified);return `  <url>\n    <loc>${esc(u)}</loc>${d?`\n    <lastmod>${d}</lastmod>`:''}\n  </url>`;}).join('\n')}\n</urlset>\n`;
}

const listing=await call({action:'sitemap'});
const approved=(listing.entries||[]).map(validateSitemapEntry);
const generated=[];
for(const entry of approved){
  const routePath=entry.route_path;
  const response=await call({action:'route',route_path:routePath});
  if(!response?.route) throw new Error(`Approved route payload missing for ${routePath}.`);
  if(safePath(response.route.route_path)!==routePath) throw new Error(`Route payload path disagrees with sitemap for ${routePath}.`);
  canonicalForRoute(response.route);
  const dir=path.join(root,routePath.slice(1));
  await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'index.html'),pageHtml(response.route,response.visual),'utf8');
  generated.push(entry);
  console.log(`Generated ${routePath}/index.html`);
}
await fs.writeFile(path.join(root,'sitemap.xml'),sitemapXml(generated),'utf8');
console.log(`Generated ${generated.length} approved public page(s) and sitemap.xml with canonical/freshness validation.`);
