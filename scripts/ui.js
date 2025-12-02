window.App = window.App || {};

(function() {
    'use strict';

    const UI = {
        state: {
            fileLoaded: false,
            fileName: '',
            activePreset: 'universal',
            isPlaying: false,
            bypass: false
        },

        init: function() {
            this.bindEvents();
            this.startVisualizer();
        },

        bindEvents: function() {
            const self = this;

            // Drag & Drop
            const $dropZone = $('#dropZone');
            const $fileInput = $('#fileInput');

            $dropZone.on('dragover', (e) => {
                e.preventDefault();
                $dropZone.addClass('border-gold bg-slate-800/50').removeClass('border-slate-700');
            });

            $dropZone.on('dragleave', (e) => {
                e.preventDefault();
                $dropZone.removeClass('border-gold bg-slate-800/50').addClass('border-slate-700');
            });

            $dropZone.on('drop', (e) => {
                e.preventDefault();
                $dropZone.removeClass('border-gold bg-slate-800/50').addClass('border-slate-700');
                const files = e.originalEvent.dataTransfer.files;
                if (files.length) self.handleFile(files[0]);
            });

            $dropZone.on('click', () => $fileInput.click());
            
            $fileInput.on('change', (e) => {
                if (e.target.files.length) self.handleFile(e.target.files[0]);
            });

            // Transport
            $('#playBtn').on('click', () => self.togglePlayback());
            
            // Waveform Scrubbing
            $('#waveformCanvas').on('click', (e) => {
                if (!self.state.fileLoaded) return;
                const canvas = e.target;
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                const time = percent * App.DSP.getDuration();
                App.DSP.seek(time);
                if (!self.state.isPlaying) self.togglePlayback();
            });

            // Presets
            $('.preset-btn').on('click', function() {
                const preset = $(this).data('preset');
                self.setPreset(preset);
            });

            // Intensity
            $('#intensityRange').on('input', function() {
                const val = parseFloat($(this).val());
                App.DSP.setIntensity(val);
            });

            // Bypass (Compare)
            $('#compareToggle').on('mousedown touchstart', () => {
                self.setBypass(true);
            }).on('mouseup touchend mouseleave', () => {
                self.setBypass(false);
            });
            
            // Export
            $('#exportBtn').on('click', () => self.showExportToast());

            // Listen for DSP end
            $(window).on('playback:ended', () => {
                self.state.isPlaying = false;
                self.updateTransportUI();
            });
        },

        handleFile: async function(file) {
            if (!file.type.startsWith('audio/')) {
                alert('Please upload a valid audio file.');
                return;
            }

            $('#uploadState').addClass('hidden');
            $('#loadingState').removeClass('hidden').addClass('flex');
            $('#fileName').text(file.name);

            try {
                const buffer = await App.Helpers.readFileAsBuffer(file);
                await App.DSP.loadAudio(buffer);
                
                this.state.fileLoaded = true;
                this.state.fileName = file.name;
                
                // Transition to Editor
                $('#loadingState').addClass('hidden').removeClass('flex');
                $('#mainInterface').removeClass('hidden').addClass('animate-in fade-in zoom-in duration-500');
                
                // Analyze waveform data for static rendering (background)
                this.renderStaticWaveform();
                
            } catch (err) {
                console.error(err);
                alert('Error processing file.');
                $('#loadingState').addClass('hidden').removeClass('flex');
                $('#uploadState').removeClass('hidden');
            }
        },

        togglePlayback: function() {
            if (!this.state.fileLoaded) return;
            
            if (this.state.isPlaying) {
                App.DSP.stop();
                this.state.isPlaying = false;
            } else {
                // If stopped at end, restart
                if (Math.abs(App.DSP.getCurrentTime() - App.DSP.getDuration()) < 0.1) {
                    App.DSP.seek(0);
                } else {
                    App.DSP.play(App.DSP.getCurrentTime());
                }
                this.state.isPlaying = true;
            }
            this.updateTransportUI();
        },

        updateTransportUI: function() {
            const $icon = $('#playBtn i');
            if (this.state.isPlaying) {
                $icon.removeClass('fa-play').addClass('fa-pause');
            } else {
                $icon.removeClass('fa-pause').addClass('fa-play');
            }
        },

        setPreset: function(name) {
            this.state.activePreset = name;
            $('.preset-btn').removeClass('ring-2 ring-amber-500 bg-slate-700').addClass('bg-slate-800');
            $(`.preset-btn[data-preset="${name}"]`).removeClass('bg-slate-800').addClass('ring-2 ring-amber-500 bg-slate-700');
            App.DSP.applyPreset(name);
        },

        setBypass: function(bypass) {
            this.state.bypass = bypass;
            App.DSP.setBypass(bypass);
            const $btn = $('#compareBtnVisual');
            if (bypass) {
                $btn.addClass('bg-amber-500 text-black').removeClass('bg-slate-700 text-white');
                $btn.text('ORIGINAL');
            } else {
                $btn.removeClass('bg-amber-500 text-black').addClass('bg-slate-700 text-white');
                $btn.text('MASTERED');
            }
        },

        showExportToast: function() {
            // Mock export
            const $toast = $(`<div class="fixed bottom-5 right-5 bg-slate-800 border border-amber-500/30 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 transform translate-y-10 opacity-0 transition-all duration-300">
                <i class="fas fa-check-circle text-amber-500"></i>
                <div>
                    <h4 class="font-bold">Export Started</h4>
                    <p class="text-sm text-slate-400">Your master is rendering...</p>
                </div>
            </div>`);
            
            $('body').append($toast);
            setTimeout(() => $toast.removeClass('translate-y-10 opacity-0'), 10);
            setTimeout(() => {
                $toast.addClass('translate-y-10 opacity-0');
                setTimeout(() => $toast.remove(), 300);
            }, 3000);
        },

        // Visualization
        renderStaticWaveform: function() {
            // Use the DSP buffer to draw a nice static waveform
            // This would be drawn on a background canvas
        },

        startVisualizer: function() {
            const canvas = document.getElementById('waveformCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const self = this;

            function draw() {
                requestAnimationFrame(draw);
                
                // Responsive Resize
                if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
                    canvas.width = canvas.clientWidth;
                    canvas.height = canvas.clientHeight;
                }

                const width = canvas.width;
                const height = canvas.height;

                ctx.clearRect(0, 0, width, height);

                if (!self.state.fileLoaded) {
                    // Idle Animation
                    ctx.beginPath();
                    ctx.moveTo(0, height/2);
                    for (let x = 0; x < width; x+=10) {
                        ctx.lineTo(x, height/2 + Math.sin(x * 0.01 + Date.now() * 0.002) * 20);
                    }
                    ctx.strokeStyle = '#334155';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    return;
                }

                // 1. Draw Static Waveform (simplified representation)
                // In a real app, we'd cache this. For now, draw a line representing current progress
                const duration = App.DSP.getDuration();
                const currentTime = App.DSP.getCurrentTime();
                const progress = duration > 0 ? currentTime / duration : 0;
                const playheadX = progress * width;

                // Time Text
                $('#currentTime').text(App.Helpers.formatTime(currentTime));
                $('#totalTime').text(App.Helpers.formatTime(duration));

                // Draw Real-time Analyzer
                if (self.state.isPlaying) {
                    const bufferLength = App.DSP.analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);
                    App.DSP.analyser.getByteFrequencyData(dataArray);

                    const barWidth = (width / bufferLength) * 2.5;
                    let barX = 0;

                    for(let i = 0; i < bufferLength; i++) {
                        const barHeight = (dataArray[i] / 255) * height * 0.8;
                        const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
                        gradient.addColorStop(0, '#f59e0b');
                        gradient.addColorStop(1, '#0f172a');
                        
                        ctx.fillStyle = gradient;
                        ctx.fillRect(barX, height - barHeight, barWidth, barHeight);
                        barX += barWidth + 1;
                        if(barX > width) break;
                    }
                }

                // Draw Playhead
                ctx.beginPath();
                ctx.moveTo(playheadX, 0);
                ctx.lineTo(playheadX, height);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            draw();
        }
    };

    App.UI = UI;
})();