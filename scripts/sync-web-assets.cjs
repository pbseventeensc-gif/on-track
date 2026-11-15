// Canonical source lives at the project root. Keep hosting and APK fallback in sync.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const files=directory=>fs.readdirSync(path.join(root,directory),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):[path.join(directory,entry.name)]).sort();
let courier=fs.readFileSync(path.join(root,'kurir.html'),'utf8');
const digest=crypto.createHash('sha256').update(courier.replace(/data-build="[^"]*"/g,'data-build="BUILD"'));
for(const file of files('js'))digest.update(file).update(fs.readFileSync(path.join(root,file)));
const build=digest.digest('hex').slice(0,16);
courier=courier.replace(/data-build="[^"]*"/g,`data-build="${build}"`);
fs.writeFileSync(path.join(root,'kurir.html'),courier);
fs.writeFileSync(path.join(root,'assets/app-version.json'),JSON.stringify({courier:build})+'\n');
for(const target of ['public','app/src/main/assets']) {
    const output=path.join(root,target);
    for(const file of ['index.html','kurir.html'])fs.copyFileSync(path.join(root,file),path.join(output,file));
    for(const directory of ['js','css'])fs.cpSync(path.join(root,directory),path.join(output,directory),{recursive:true});
    fs.mkdirSync(path.join(output,'assets'),{recursive:true});
    fs.copyFileSync(path.join(root,'assets/app-version.json'),path.join(output,'assets/app-version.json'));
}
console.log(JSON.stringify({synced:['public','app/src/main/assets'],courierBuild:build}));
