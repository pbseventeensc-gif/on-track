// Canonical source lives at the project root. Keep hosting and APK fallback in sync.
const fs=require('node:fs');
const path=require('node:path');
const {buildCourier}=require('./courier-build.cjs');
const root=path.resolve(__dirname,'..');
let courier=fs.readFileSync(path.join(root,'kurir.html'),'utf8');
const build=buildCourier(root);
courier=courier.replace(/data-build="[^"]*"/g,`data-build="${build}"`);
fs.writeFileSync(path.join(root,'kurir.html'),courier);
fs.writeFileSync(path.join(root,'assets/app-version.json'),JSON.stringify({courier:build})+'\n');
for(const target of ['public','app/src/main/assets']) {
    const output=path.join(root,target);
    for(const file of ['index.html','kurir.html','download.html'])fs.copyFileSync(path.join(root,file),path.join(output,file));
    for(const directory of ['js','css'])fs.cpSync(path.join(root,directory),path.join(output,directory),{recursive:true});
    fs.mkdirSync(path.join(output,'assets'),{recursive:true});
    fs.copyFileSync(path.join(root,'assets/app-version.json'),path.join(output,'assets/app-version.json'));
}
console.log(JSON.stringify({synced:['public','app/src/main/assets'],courierBuild:build}));
