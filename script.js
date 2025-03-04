class Game {
    constructor() {
        this.score = 0;
        this.round = 1;
        this.gameLength = 120;
        this.timeRemaining = this.gameLength;
        this.goodWhacks = 0;
        this.badWhacks = 0;
        this.isPlaying = false;
        this.barcodeInterval = null;
        this.timerInterval = null;
        this.scanner = null;
        this.currentBarcode = '';
        this.setupEventListeners();
        this.loadHighScores();
    }

    setupEventListeners() {
        document.getElementById('startGame').addEventListener('click', () => this.startGame());
        document.getElementById('nextRound').addEventListener('click', () => this.startNextRound());
        document.getElementById('saveScore').addEventListener('click', () => this.saveHighScore());
        document.getElementById('playAgain').addEventListener('click', () => this.resetGame());
        document.getElementById('gameLength').addEventListener('change', (e) => {
            this.gameLength = parseInt(e.target.value);
            this.timeRemaining = this.gameLength;
            document.getElementById('timerValue').textContent = this.timeRemaining;
        });
    }

    startGame() {
        this.isPlaying = true;
        document.getElementById('menuScreen').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
        this.setupScanner();
        this.startRound();
    }

    setupScanner() {
        this.scanner = new Html5Qrcode("reader");
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            formatsToSupport: [
                Html5QrcodeScanType.SCAN_TYPE_BARCODE_WITH_SS,  // Support keyboard-like scanners
                Html5QrcodeScanType.SCAN_TYPE_CODE_128,
                Html5QrcodeScanType.SCAN_TYPE_CODE_39,
                Html5QrcodeScanType.SCAN_TYPE_EAN_13,
                Html5QrcodeScanType.SCAN_TYPE_QR_CODE
            ]
        };

        // Add keyboard event listener for USB scanners
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.currentBarcode) {
                this.onScan(this.currentBarcode);
                this.currentBarcode = '';
            } else {
                this.currentBarcode = (this.currentBarcode || '') + e.key;
            }
        });

        // Start the camera scanner as well
        this.scanner.start(
            { facingMode: "environment" },
            config,
            this.onScan.bind(this)
        ).catch(err => {
            console.log('Camera scanner failed to start, falling back to keyboard mode:', err);
            // Continue with keyboard mode only
        });
    }

    startRound() {
        this.updateDisplay();
        this.startTimer();
        this.generateBarcodes();
    }

    generateBarcodes() {
        const spawnInterval = Math.max(2000 - (this.round * 200), 500);
        this.barcodeInterval = setInterval(() => {
            if (this.isPlaying) {
                this.spawnBarcode();
            }
        }, spawnInterval);
    }

    spawnBarcode() {
        const gameArea = document.getElementById('gameArea');
        const barcode = document.createElement('div');
        barcode.className = 'barcode';
        
        // Randomly decide if this is a bad barcode (20% chance)
        const isBad = Math.random() < 0.2;
        if (isBad) barcode.classList.add('bad');

        // Generate random position (ensuring no overlap)
        const position = this.getRandomPosition(gameArea);
        if (!position) {
            console.log('Could not find non-overlapping position, skipping barcode spawn');
            return;
        }

        barcode.style.left = position.left + 'px';
        barcode.style.top = position.top + 'px';

        // Create QR code or barcode
        const isQR = Math.random() < 0.3;
        // Use simpler values that are easier to scan
        const value = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        
        if (isQR) {
            // Use a QR code image
            barcode.style.backgroundImage = `url(https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${value})`;
            barcode.style.width = '100px';
            barcode.style.height = '100px';
            barcode.style.backgroundSize = 'contain';
            barcode.style.backgroundRepeat = 'no-repeat';
            console.log('Spawned QR code with value:', value);
        } else {
            // Use a barcode image with Code 128 format
            barcode.style.backgroundImage = `url(https://bwipjs-api.metafloor.com/bcid?text=${value}&bcid=code128&scale=2&height=50&includetext=true)`;
            barcode.style.width = '150px';
            barcode.style.height = '50px';
            barcode.style.backgroundSize = 'contain';
            barcode.style.backgroundRepeat = 'no-repeat';
            console.log('Spawned barcode with value:', value);
        }

        barcode.dataset.value = value;
        gameArea.appendChild(barcode);
        console.log('Total barcodes in game area:', gameArea.getElementsByClassName('barcode').length);

        // Remove after delay
        setTimeout(() => {
            if (barcode.parentNode) {
                barcode.remove();
                console.log('Removed barcode due to timeout:', value);
            }
        }, Math.max(3000 - (this.round * 200), 1000));
    }

    getRandomPosition(gameArea) {
        const areaRect = gameArea.getBoundingClientRect();
        const maxTries = 50;
        let tries = 0;
        
        while (tries < maxTries) {
            const left = Math.random() * (areaRect.width - 150);
            const top = Math.random() * (areaRect.height - 100);
            
            // Check for overlap with existing barcodes
            const overlap = Array.from(gameArea.getElementsByClassName('barcode')).some(existing => {
                const rect1 = {
                    left: left,
                    right: left + 150,
                    top: top,
                    bottom: top + 100
                };
                const rect2 = existing.getBoundingClientRect();
                
                return !(rect1.left > rect2.right || 
                        rect1.right < rect2.left || 
                        rect1.top > rect2.bottom ||
                        rect1.bottom < rect2.top);
            });
            
            if (!overlap) {
                return { left, top };
            }
            
            tries++;
        }
        
        // If we couldn't find a non-overlapping position, return null
        return null;
    }

    onScan(decodedText) {
        console.log('Scanned value:', decodedText);
        const barcodes = document.getElementsByClassName('barcode');
        console.log('Looking for match among', barcodes.length, 'barcodes');
        
        for (const barcode of barcodes) {
            console.log('Comparing with barcode value:', barcode.dataset.value);
            if (barcode.dataset.value === decodedText) {
                console.log('Match found!');
                const isBad = barcode.classList.contains('bad');
                if (isBad) {
                    this.score = Math.max(0, this.score - 10);
                    this.badWhacks++;
                    barcode.classList.add('bad-scanned');
                    console.log('Bad barcode scanned, new score:', this.score);
                } else {
                    this.score += 10;
                    this.goodWhacks++;
                    barcode.classList.add('scanned');
                    console.log('Good barcode scanned, new score:', this.score);
                }
                setTimeout(() => barcode.remove(), 500);
                this.updateDisplay();
                break;
            }
        }
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            document.getElementById('timerValue').textContent = this.timeRemaining;
            
            if (this.timeRemaining <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    endGame() {
        this.isPlaying = false;
        clearInterval(this.timerInterval);
        clearInterval(this.barcodeInterval);
        
        if (this.scanner) {
            this.scanner.stop();
        }

        document.getElementById('gameScreen').classList.add('hidden');
        document.getElementById('gameOver').classList.remove('hidden');
        document.getElementById('finalScore').textContent = this.score;
    }

    startNextRound() {
        this.round++;
        document.getElementById('roundStats').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
        this.startRound();
    }

    showRoundStats() {
        const accuracy = Math.round((this.goodWhacks / (this.goodWhacks + this.badWhacks)) * 100) || 0;
        document.getElementById('accuracyValue').textContent = accuracy;
        document.getElementById('goodWhacks').textContent = this.goodWhacks;
        document.getElementById('badWhacks').textContent = this.badWhacks;

        let message = '';
        if (accuracy >= 90) message = "Fantastic!";
        else if (accuracy >= 70) message = "Not bad!";
        else if (accuracy >= 50) message = "You can do better!";
        else message = "Keep practicing!";

        document.getElementById('statsMessage').textContent = message;
        document.getElementById('gameScreen').classList.add('hidden');
        document.getElementById('roundStats').classList.remove('hidden');
    }

    saveHighScore() {
        const playerName = document.getElementById('playerName').value.trim();
        if (!playerName) return;

        const highScores = JSON.parse(localStorage.getItem('highScores') || '[]');
        highScores.push({
            name: playerName,
            score: this.score,
            date: new Date().toLocaleDateString()
        });

        highScores.sort((a, b) => b.score - a.score);
        highScores.splice(10); // Keep only top 10 scores

        localStorage.setItem('highScores', JSON.stringify(highScores));
        this.loadHighScores();
        this.resetGame();
    }

    loadHighScores() {
        const highScores = JSON.parse(localStorage.getItem('highScores') || '[]');
        const list = document.getElementById('highScoresList');
        list.innerHTML = '';
        
        highScores.forEach(score => {
            const li = document.createElement('li');
            li.textContent = `${score.name}: ${score.score} (${score.date})`;
            list.appendChild(li);
        });
    }

    resetGame() {
        this.score = 0;
        this.round = 1;
        this.timeRemaining = this.gameLength;
        this.goodWhacks = 0;
        this.badWhacks = 0;
        
        document.getElementById('gameOver').classList.add('hidden');
        document.getElementById('menuScreen').classList.remove('hidden');
        this.updateDisplay();
    }

    updateDisplay() {
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('roundValue').textContent = this.round;
        document.getElementById('timerValue').textContent = this.timeRemaining;
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
}); 