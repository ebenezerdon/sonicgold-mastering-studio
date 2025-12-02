window.App = window.App || {};

(function() {
    'use strict';

    App.Helpers = {
        /**
         * Format seconds into MM:SS
         */
        formatTime: function(seconds) {
            if (!seconds || isNaN(seconds)) return '0:00';
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m}:${s < 10 ? '0' : ''}${s}`;
        },

        /**
         * Convert File object to ArrayBuffer
         */
        readFileAsBuffer: function(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsArrayBuffer(file);
            });
        },

        /**
         * Generate a unique ID
         */
        generateId: function() {
            return Math.random().toString(36).substr(2, 9);
        },

        /**
         * Ease function for smooth animations
         */
        easeOutQuad: function(t) {
            return t * (2 - t);
        }
    };
})();