/* Web updates are applied when returning to the courier page, outside an active form. */
(function(root) {
    'use strict';
    if(root.WTRACK_LOCAL_SANDBOX||root.location.protocol==='file:')return;
    const build=root.document.currentScript?.dataset.build;
    if(!build)return;
    let checking=false;
    function canReload() {
        if(root.document.hidden)return false;
        if(root.document.querySelector('.modal.show, dialog[open]'))return false;
        const focused=root.document.activeElement;
        if(focused?.matches('input,textarea')&&focused.value)return false;
        return !root.document.querySelector('button[disabled][data-proof-busy]');
    }
    async function check() {
        if(checking||!canReload()||!root.navigator.onLine)return;
        checking=true;
        try {
            const response=await root.fetch('/assets/app-version.json',{cache:'no-store'});
            if(!response.ok)return;
            const version=await response.json();
            if(version.courier&&version.courier!==build&&canReload())root.location.reload();
        } catch { /* Keep the currently usable page during a connection failure. */ }
        finally {checking=false;}
    }
    root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden)check();});
    root.addEventListener('online',check);
    root.setInterval(check,60000);
})(window);
