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
        // Remove camera scanner, only use keyboard input for USB scanner
        document.addEventListener('keypress', (e) => {
            console.log('Key pressed:', e.key, 'Current barcode buffer:', this.currentBarcode);
            if (e.key === 'Enter' && this.currentBarcode) {
                console.log('Processing complete barcode:', this.currentBarcode);
                this.onScan(this.currentBarcode);
                this.currentBarcode = '';
            } else {
                this.currentBarcode = (this.currentBarcode || '') + e.key;
            }
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
        
        // Don't spawn if we already have too many barcodes
        if (gameArea.getElementsByClassName('barcode').length >= 8) {
            return;
        }

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

        // Create a simple 4-digit number for easier scanning
        const value = Math.floor(Math.random() * 9000 + 1000).toString(); // 4-digit number between 1000-9999
        
        // Create barcode content
        const barcodeContent = document.createElement('div');
        barcodeContent.className = 'barcode-content';
        barcodeContent.textContent = value;
        barcodeContent.style.fontSize = '32px';
        barcodeContent.style.fontFamily = 'monospace';
        barcodeContent.style.fontWeight = 'bold';
        barcodeContent.style.letterSpacing = '4px';
        barcodeContent.style.marginBottom = '10px';
        barcode.appendChild(barcodeContent);

        // Create barcode bars
        const barcodeImage = document.createElement('div');
        barcodeImage.className = 'barcode-image';
        barcodeImage.style.height = '80px';
        barcodeImage.style.width = '200px';
        barcodeImage.style.background = this.generateBarcodePattern(value);
        barcode.appendChild(barcodeImage);

        barcode.dataset.value = value;
        gameArea.appendChild(barcode);
        console.log('Spawned barcode with value:', value);
        console.log('Total barcodes in game area:', gameArea.getElementsByClassName('barcode').length);

        // Remove after delay
        setTimeout(() => {
            if (barcode.parentNode) {
                barcode.remove();
                console.log('Removed barcode due to timeout:', value);
            }
        }, Math.max(3000 - (this.round * 200), 1000));
    }

    generateBarcodePattern(value) {
        // Create a simple barcode-like pattern
        let pattern = 'linear-gradient(90deg,';
        const chars = value.split('');
        let position = 0;

        // Start pattern (black bar)
        pattern += `black 0%, black 2%,`;
        position = 2;

        // Generate pattern for each number
        chars.forEach((char, index) => {
            const num = parseInt(char);
            // Each number gets 20% of the width (excluding start/end patterns)
            const segmentWidth = 20;
            const start = position;
            
            // Create varying bar widths based on the number
            for (let i = 0; i < 4; i++) {
                const isBar = ((num + i) % 2) === 0;
                const barWidth = 5; // Each bar/space is 5% wide
                pattern += `${isBar ? 'black' : 'white'} ${start + (i * barWidth)}%, `;
                pattern += `${isBar ? 'black' : 'white'} ${start + ((i + 1) * barWidth)}%${i < 3 || index < chars.length - 1 ? ',' : ''}`;
            }
            position += segmentWidth;
        });

        // End pattern (black bar)
        pattern += `, black 98%, black 100%)`;
        return pattern;
    }

    getRandomPosition(gameArea) {
        const areaRect = gameArea.getBoundingClientRect();
        const maxTries = 50;
        let tries = 0;
        
        // Updated dimensions to match our new barcode size plus padding
        const barcodeWidth = 260; // 220px min-width + 40px padding
        const barcodeHeight = 200; // Approximate height including padding
        const margin = 20; // Extra margin between barcodes
        
        while (tries < maxTries) {
            const left = Math.random() * (areaRect.width - barcodeWidth);
            const top = Math.random() * (areaRect.height - barcodeHeight);
            
            // Check for overlap with existing barcodes
            const overlap = Array.from(gameArea.getElementsByClassName('barcode')).some(existing => {
                const rect1 = {
                    left: left - margin,
                    right: left + barcodeWidth + margin,
                    top: top - margin,
                    bottom: top + barcodeHeight + margin
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
        
        // If we couldn't find a non-overlapping position after maxTries,
        // try to find any position with minimal overlap
        if (tries === maxTries) {
            const barcodes = Array.from(gameArea.getElementsByClassName('barcode'));
            if (barcodes.length < 5) { // Only if we have few barcodes
                const left = Math.random() * (areaRect.width - barcodeWidth);
                const top = Math.random() * (areaRect.height - barcodeHeight);
                return { left, top };
            }
        }
        
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