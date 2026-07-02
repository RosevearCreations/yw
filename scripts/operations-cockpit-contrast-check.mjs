#!/usr/bin/env node
/** Static contrast and dark-surface contract for the Operations Cockpit. */
import fs from 'node:fs';
const css=fs.readFileSync('style.css','utf8');
const required=[
  'Build 2026-06-23a — Operations Cockpit contrast remediation',
  '--oc-text: #f8fbff',
  '--oc-surface: #0c172b',
  '.operations-cockpit .operations-status[data-status="error"]',
  '.operations-cockpit .oc-badge-approved',
  '.operations-cockpit .oc-badge-rejected',
  '.operations-cockpit .oc-permission.is-allowed',
  '.operations-cockpit .oc-permission.is-restricted',
  '.operations-cockpit .operations-form :is(input, select, textarea)',
  'outline: 3px solid rgba(147, 197, 253, 0.68)',
  '@media (forced-colors: active)',
  '.operations-cockpit .oc-release-dashboard-card',
  '.operations-cockpit .oc-release-gates'
];
const hexToRgb=(hex)=>{const clean=hex.replace('#','');return [0,2,4].map((i)=>parseInt(clean.slice(i,i+2),16)/255);};
const linear=(value)=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4;
const luminance=(hex)=>{const [r,g,b]=hexToRgb(hex).map(linear);return 0.2126*r+0.7152*g+0.0722*b;};
const contrast=(a,b)=>{const [x,y]=[luminance(a),luminance(b)].sort((m,n)=>n-m);return (x+0.05)/(y+0.05);};
const pairs=[
  ['normal copy','#f8fbff','#0c172b',4.5],
  ['supporting copy','#d3dff2','#0c172b',4.5],
  ['muted copy','#b5c4dc','#0c172b',4.5],
  ['success state','#c7f9dd','#123e35',4.5],
  ['warning state','#ffe5a3','#4a3510',4.5],
  ['error state','#ffd6da','#54242b',4.5],
  ['allowed permission','#c7f9dd','#123e35',4.5],
  ['restricted permission','#ffe5a3','#4a3510',4.5]
];
const failures=[];
for(const token of required)if(!css.includes(token))failures.push(`Missing required Cockpit contrast token/rule: ${token}`);
for(const [name,fg,bg,min] of pairs){const ratio=contrast(fg,bg);console.log(`${name}: ${ratio.toFixed(2)}:1`);if(ratio<min)failures.push(`${name} contrast ${ratio.toFixed(2)}:1 is below ${min}:1`);}
if(failures.length){for(const failure of failures)console.error(`FAIL  ${failure}`);process.exit(1);}
console.log('PASS  Operations Cockpit dark-surface contrast contract.');
