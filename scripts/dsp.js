window.App = window.App || {};

(function() {
    'use strict';

    // The Mastering Engine Class
    class MasteringEngine {
        constructor() {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.sourceNode = null;
            this.isPlaying = false;
            this.buffer = null;
            this.startTime = 0;
            this.pauseTime = 0;
            this.isBypassed = false;
            this.intensity = 0.8; // 0 to 1
            this.currentPreset = 'universal';
            
            // Chain Nodes
            this.inputGain = this.audioCtx.createGain();
            this.outputGain = this.audioCtx.createGain();
            this.nodes = {}; // Store EQ, Comp, etc.
            
            // Analyzer for visualization
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 2048;
            
            // Connect output
            this.outputGain.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
        }

        async loadAudio(arrayBuffer) {
            if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
            const decodedData = await this.audioCtx.decodeAudioData(arrayBuffer);
            this.buffer = decodedData;
            return decodedData;
        }

        setupChain() {
            // Disconnect old chain if exists
            this.inputGain.disconnect();
            
            // Create Nodes
            // 1. Pre-EQ (Correction)
            this.nodes.lowShelf = this.audioCtx.createBiquadFilter();
            this.nodes.lowShelf.type = 'lowshelf';
            
            this.nodes.midPeaking = this.audioCtx.createBiquadFilter();
            this.nodes.midPeaking.type = 'peaking';
            
            this.nodes.highShelf = this.audioCtx.createBiquadFilter();
            this.nodes.highShelf.type = 'highshelf';

            // 2. Multiband Simulation (Simple Compressor for now)
            this.nodes.compressor = this.audioCtx.createDynamicsCompressor();
            
            // 3. Saturation (WaveShaper)
            this.nodes.shaper = this.audioCtx.createWaveShaper();
            this.nodes.shaper.curve = this._makeDistortionCurve(0); // Default none
            
            // 4. Limiter (Fast compressor at end)
            this.nodes.limiter = this.audioCtx.createDynamicsCompressor();
            this.nodes.limiter.threshold.value = -1.0;
            this.nodes.limiter.knee.value = 0.0;
            this.nodes.limiter.ratio.value = 20.0;
            this.nodes.limiter.attack.value = 0.001;
            this.nodes.limiter.release.value = 0.1;

            // Connect the path
            // Input -> Low -> Mid -> High -> Compressor -> Shaper -> Limiter -> Output
            this.inputGain.connect(this.nodes.lowShelf);
            this.nodes.lowShelf.connect(this.nodes.midPeaking);
            this.nodes.midPeaking.connect(this.nodes.highShelf);
            this.nodes.highShelf.connect(this.nodes.compressor);
            this.nodes.compressor.connect(this.nodes.shaper);
            this.nodes.shaper.connect(this.nodes.limiter);
            this.nodes.limiter.connect(this.outputGain);
            
            this.applyPreset(this.currentPreset);
        }

        play(startOffset = 0) {
            if (!this.buffer) return;
            this.stop();
            
            this.sourceNode = this.audioCtx.createBufferSource();
            this.sourceNode.buffer = this.buffer;
            
            // Routing
            if (this.isBypassed) {
                this.sourceNode.connect(this.outputGain);
            } else {
                this.setupChain();
                this.sourceNode.connect(this.inputGain);
            }

            this.startTime = this.audioCtx.currentTime - startOffset;
            this.pauseTime = startOffset;
            this.sourceNode.start(0, startOffset);
            this.isPlaying = true;
            
            this.sourceNode.onended = () => {
                // Only trigger stop if natural end, not manual stop
                if (this.audioCtx.currentTime - this.startTime >= this.buffer.duration) {
                    this.isPlaying = false;
                    $(window).trigger('playback:ended');
                }
            };
        }

        stop() {
            if (this.sourceNode) {
                try { this.sourceNode.stop(); } catch(e) {}
                this.sourceNode.disconnect();
                this.sourceNode = null;
            }
            this.isPlaying = false;
        }

        seek(time) {
            const wasPlaying = this.isPlaying;
            this.stop();
            if (wasPlaying) {
                this.play(time);
            } else {
                this.pauseTime = time;
            }
        }

        setBypass(bypass) {
            this.isBypassed = bypass;
            if (this.isPlaying) {
                // Seamless switch requires cursor preservation
                const currentPos = this.audioCtx.currentTime - this.startTime;
                this.play(currentPos);
            }
        }

        applyPreset(name) {
            this.currentPreset = name;
            // Base settings modified by intensity
            const p = this._getPresetSettings(name);
            const i = this.intensity;

            // EQ
            this.nodes.lowShelf.frequency.value = p.lowFreq || 100;
            this.nodes.lowShelf.gain.value = (p.lowGain || 0) * i;
            
            this.nodes.midPeaking.frequency.value = p.midFreq || 1000;
            this.nodes.midPeaking.Q.value = p.midQ || 1;
            this.nodes.midPeaking.gain.value = (p.midGain || 0) * i;

            this.nodes.highShelf.frequency.value = p.highFreq || 10000;
            this.nodes.highShelf.gain.value = (p.highGain || 0) * i;

            // Compression
            this.nodes.compressor.threshold.value = (p.compThresh || -24) + ((1-i) * 10); // Less intensity = higher threshold
            this.nodes.compressor.knee.value = p.compKnee || 30;
            this.nodes.compressor.ratio.value = 1 + ((p.compRatio - 1) * i);
            this.nodes.compressor.attack.value = p.compAttack || 0.003;
            this.nodes.compressor.release.value = p.compRelease || 0.25;

            // Saturation
            if (p.saturation > 0) {
                 this.nodes.shaper.curve = this._makeDistortionCurve(p.saturation * i);
            } else {
                 this.nodes.shaper.curve = this._makeDistortionCurve(0);
            }
        }

        setIntensity(val) {
            this.intensity = val;
            if (!this.isBypassed && this.nodes.compressor) {
                this.applyPreset(this.currentPreset);
            }
        }

        _getPresetSettings(name) {
            switch(name) {
                case 'fire': 
                    return { 
                        lowGain: 2.5, highGain: 1.0, midGain: -1.0, 
                        compThresh: -20, compRatio: 3, saturation: 15 
                    };
                case 'clarity':
                    return { 
                        lowGain: -1.0, highGain: 2.5, midGain: 0.5, midFreq: 2500,
                        compThresh: -16, compRatio: 2, saturation: 2
                    };
                case 'retro':
                    return {
                        lowGain: 1.5, highGain: -2.0, midGain: 1.0, midFreq: 800,
                        compThresh: -15, compRatio: 2.5, saturation: 20
                    };
                case 'universal':
                default:
                    return {
                        lowGain: 1.0, highGain: 1.0, midGain: -0.5,
                        compThresh: -18, compRatio: 2.5, saturation: 5
                    };
            }
        }

        _makeDistortionCurve(amount) {
            const k = (typeof amount === 'number' ? amount : 0) * 0.5;
            const n_samples = 44100;
            const curve = new Float32Array(n_samples);
            
            for (let i = 0; i < n_samples; ++i) {
                const x = i * 2 / n_samples - 1;
                // Normalized soft-clipping: (PI + k) * x / (PI + k * |x|)
                // This acts as a maximizer/saturator that hits 1.0 at input 1.0
                curve[i] = (Math.PI + k) * x / (Math.PI + k * Math.abs(x));
            }
            return curve;
        }

        getCurrentTime() {
            if (!this.isPlaying) return this.pauseTime;
            return Math.min(this.audioCtx.currentTime - this.startTime, this.buffer ? this.buffer.duration : 0);
        }

        getDuration() {
            return this.buffer ? this.buffer.duration : 0;
        }
    }

    App.DSP = new MasteringEngine();
})();