const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');

test('courier initialization, sign-in and logout keep the admin Firebase session intact',async()=>{
 const html=fs.readFileSync('kurir.html','utf8'),services=new Map(),apps=[{name:'[DEFAULT]'}];
 const service=app=>{const name=app?.name||'[DEFAULT]';if(!services.has(name))services.set(name,{currentUser:null,onAuthStateChanged(){},async signInWithEmailAndPassword(email){this.currentUser={uid:email,email};return {user:this.currentUser};},async signOut(){this.currentUser=null;}});return services.get(name);};
 service(apps[0]).currentUser={uid:'admin'};
 const dbApps=[],storageApps=[];
 const firebase={apps,app:name=>{const app=apps.find(a=>a.name===name);assert.ok(app);return app;},initializeApp:(config,name)=>{const app={name};apps.push(app);return app;},auth:service,firestore:app=>{dbApps.push(app.name);return {};},storage:app=>{storageApps.push(app.name);return {};}};
 const context=vm.createContext({firebase,firebaseConfig:{},window:{},console,document:{getElementById:()=>null},localStorage:{removeItem(){}},navigateToScreen(){},showToast(){},masterShipments:[]});
 const start=html.indexOf('    let firestoreDb = null;'),end=html.indexOf('    async function uploadProofPhotoOnline',start);
 vm.runInContext(html.slice(start,end),context);
 assert.deepEqual(dbApps,['wtrack-courier']);assert.deepEqual(storageApps,['wtrack-courier']);
 await service(apps[1]).signInWithEmailAndPassword('courier');
 const logoutStart=html.indexOf('    function confirmCourierLogout()'),logoutEnd=html.indexOf('    // GPS State:',logoutStart);
 vm.runInContext(html.slice(logoutStart,logoutEnd),context);
 context.confirmCourierLogout();
 assert.equal(service(apps[1]).currentUser,null);
 assert.equal(service(apps[0]).currentUser.uid,'admin');
 // Every auth operation in the courier page must use the isolated app.
 assert.doesNotMatch(html,/firebase\.auth\(\)/);
});
