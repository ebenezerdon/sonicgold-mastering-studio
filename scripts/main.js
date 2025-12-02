$(function() {
    // Safety check
    const hasApp = !!window.App;
    const hasUI = hasApp && !!window.App.UI;
    
    if (!hasApp || !hasUI) {
        console.error('App initialization failed: Missing dependencies');
        return;
    }

    // Initialize the UI logic
    window.App.UI.init();

    console.log('SonicGold Mastering Engine Loaded.');
});