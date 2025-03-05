class Game {
    constructor() {
        this.score = 0;
        this.round = 1;
        this.totalRounds = 5; // Default total rounds
        this.roundLength = 120; // Default round length in seconds
        this.timeRemaining = this.roundLength;
        this.goodWhacks = 0;
        this.badWhacks = 0;
        this.isPlaying = false;
        this.barcodeInterval = null;
        this.timerInterval = null;
        this.scanner = null;
        this.currentBarcode = '';
        this.bonusLength = 20; // 20 seconds bonus round
        this.bonusActive = false;
        this.bonusCodesTotal = 5; // Number of bonus QR codes
        this.bonusCodesScanned = 0;
        this.roundMultiplier = 1;
        this.isPaused = false;
        this.PAUSE_BARCODE = 'PAUSE';  // Special value for pause/unpause
        this.barcodeBuffer = '';  // Add this line
        this.previousRoundScore = 0;  // Needed for bonus round calculations
        this.gameArea = null;  // Store reference to game area
        this.isGameOver = false;  // Explicit game over state
        this.initializeGameArea();
        this.setupEventListeners();
        this.setupScanner();
        this.loadHighScores();
        this.setupPauseHandler();
    }

    initializeGameArea() {
        this.gameArea = document.getElementById('gameArea');
        if (!this.gameArea) {
            console.error('Game area element not found!');
            return;
        }
    }

    setupEventListeners() {
        document.getElementById('startGame').addEventListener('click', () => this.startGame());
        document.getElementById('nextRound').addEventListener('click', () => this.startNextRound());
        document.getElementById('saveScore').addEventListener('click', () => this.saveHighScore());
        document.getElementById('playAgain').addEventListener('click', () => this.resetGame());
        
        // Modified to handle both round length and total rounds
        document.getElementById('roundLength').addEventListener('change', (e) => {
            this.roundLength = parseInt(e.target.value);
            this.timeRemaining = this.roundLength;
            document.getElementById('timerValue').textContent = this.timeRemaining;
        });
        
        document.getElementById('totalRounds').addEventListener('change', (e) => {
            this.totalRounds = parseInt(e.target.value);
        });
    }

    setupPauseHandler() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isPlaying) {
                this.togglePause();
            }
        });
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            // Pause the game
            clearInterval(this.timerInterval);
            clearInterval(this.barcodeInterval);
            
            // Show pause screen with scannable barcode
            const pauseScreen = document.createElement('div');
            pauseScreen.id = 'pauseScreen';
            pauseScreen.className = 'pause-screen';
            pauseScreen.innerHTML = `
                <div class="pause-content">
                    <h2>Game Paused</h2>
                    <p>Press ESC or scan below to resume</p>
                    <div class="resume-barcode">
                        <div class="barcode-content">
                            <div style="font-size: 32px; font-family: monospace; font-weight: bold; letter-spacing: 4px; margin-bottom: 10px;">
                                ${this.PAUSE_BARCODE}
                            </div>
                            <svg class="barcode-image"
                                jsbarcode-format="code128"
                                jsbarcode-value="${this.PAUSE_BARCODE}"
                                jsbarcode-width="2"
                                jsbarcode-height="80"
                                jsbarcode-fontSize="16"
                                jsbarcode-margin="10">
                            </svg>
                        </div>
                    </div>
                </div>
            `;
            document.querySelector('.game-container').appendChild(pauseScreen);
            
            // Generate the actual barcode
            JsBarcode(pauseScreen.querySelector('.barcode-image'), this.PAUSE_BARCODE, {
                format: "code128",
                width: 2,
                height: 80,
                fontSize: 16,
                margin: 10
            });
        } else {
            this.unpauseGame();
        }
    }

    unpauseGame() {
        // Resume the game
        this.startTimer();
        this.generateBarcodes();
        
        // Remove pause screen
        const pauseScreen = document.getElementById('pauseScreen');
        if (pauseScreen) {
            pauseScreen.remove();
        }
    }

    startGame() {
        if (this.isGameOver) {
            this.resetGame();
        }
        
        this.isPlaying = true;
        this.isGameOver = false;
        this.score = 0;
        this.round = 1;
        this.previousRoundScore = 0;
        
        document.getElementById('menuScreen').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
        
        this.startRound();
    }

    setupScanner() {
        let scanBuffer = '';
        let scanTimeout = null;

        document.addEventListener('keypress', (e) => {
            // Add character to buffer
            scanBuffer += e.key;
            console.log('Scan buffer:', scanBuffer);  // Debug log
            
            // Clear existing timeout
            if (scanTimeout) {
                clearTimeout(scanTimeout);
            }

            // Set new timeout to process buffer
            scanTimeout = setTimeout(() => {
                if (scanBuffer) {
                    // Remove any trailing newlines/enters
                    const cleanCode = scanBuffer.replace(/[\r\n]/g, '');
                    console.log('Processing scan:', cleanCode);
                    this.processBarcode(cleanCode);
                    scanBuffer = '';
                }
            }, 50); // 50ms timeout

            // Also process immediately if Enter is pressed
            if (e.key === 'Enter' && scanBuffer) {
                clearTimeout(scanTimeout);
                const cleanCode = scanBuffer.replace(/[\r\n]/g, '');
                console.log('Processing scan (Enter):', cleanCode);
                this.processBarcode(cleanCode);
                scanBuffer = '';
            }
        });
    }

    processBarcode(code) {
        if (!this.isPlaying) return;  // Only process if game is active
        
        console.log('Processing barcode:', code);  // Debug log

        // Check for pause barcode
        if (code === this.PAUSE_BARCODE) {
            this.togglePause();
            return;
        }

        if (this.bonusActive) {
            // Handle bonus QR codes
            const bonusQRs = document.getElementsByClassName('bonus-qr');
            let found = false;
            
            for (const qr of bonusQRs) {
                if (qr.dataset.value === code) {
                    found = true;
                    this.bonusCodesScanned++;
                    qr.classList.add('scanned');
                    setTimeout(() => qr.remove(), 500);
                    break;
                }
            }

            if (!found) {
                console.log('Bonus QR not found:', code);
            }
        } else {
            // Handle regular barcodes
            const barcodes = document.getElementsByClassName('barcode');
            let found = false;
            
            for (const barcode of barcodes) {
                if (barcode.dataset.value === code) {
                    found = true;
                    const isBad = barcode.classList.contains('bad');
                    
                    if (isBad) {
                        this.score = Math.max(0, this.score - 10);
                        this.badWhacks++;
                        barcode.classList.add('bad-scanned');
                    } else {
                        this.score += 10;
                        this.goodWhacks++;
                        barcode.classList.add('scanned');
                    }
                    
                    setTimeout(() => barcode.remove(), 500);
                    this.updateDisplay();
                    break;
                }
            }

            if (!found) {
                console.log('Barcode not found:', code);
            }
        }
    }

    startRound() {
        // Store score before round starts for bonus calculations
        this.previousRoundScore = this.score;
        
        // Reset round-specific counters
        this.goodWhacks = 0;
        this.badWhacks = 0;
        this.timeRemaining = this.roundLength;
        
        this.updateDisplay();
        this.startTimer();
        this.generateBarcodes();
    }

    generateBarcodes() {
        if (this.barcodeInterval) {
            clearInterval(this.barcodeInterval);
        }
        
        // Increase difficulty with each round
        const spawnInterval = Math.max(2000 - (this.round * 200), 500);
        const maxBarcodes = Math.min(5 + this.round, 8);  // Increase max barcodes with rounds
        
        this.barcodeInterval = setInterval(() => {
            if (!this.isPlaying || this.isPaused) return;
            
            const currentBarcodes = this.gameArea.getElementsByClassName('barcode').length;
            if (currentBarcodes < maxBarcodes) {
                this.spawnBarcode();
            }
        }, spawnInterval);
    }

    spawnBarcode() {
        const barcode = document.createElement('div');
        barcode.className = 'barcode';
        
        // Get non-overlapping position
        const position = this.getRandomPosition(this.gameArea);
        if (!position) return;
        
        barcode.style.left = position.left + 'px';
        barcode.style.top = position.top + 'px';
        
        // Increase bad barcode probability with each round
        const badProbability = Math.min(0.2 + (this.round * 0.05), 0.4);
        const isBad = Math.random() < badProbability;
        if (isBad) barcode.classList.add('bad');

        // Set unique value and add timeout
        const value = Math.floor(Math.random() * 9000 + 1000).toString();
        barcode.dataset.value = value;
        
        // Add timeout to remove unscanned barcodes
        const timeout = Math.max(5000 - (this.round * 300), 2000);
        setTimeout(() => {
            if (barcode.parentNode) {
                console.log('Removed barcode due to timeout:', value);
                barcode.remove();
            }
        }, timeout);

        this.gameArea.appendChild(barcode);
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
            // Width of each bar is based on the number (1-9)
            const width = (num + 1) * 2;
            
            // Add white space
            pattern += `white ${position}%, white ${position + 2}%,`;
            position += 2;
            
            // Add black bar
            pattern += `black ${position}%, black ${position + width}%,`;
            position += width;
        });

        // End pattern (black bar)
        pattern += `white ${position}%, white ${position + 2}%,`;
        position += 2;
        pattern += `black ${position}%, black ${position + 2}%`;

        return pattern + ')';
    }

    getRandomPosition(gameArea) {
        const areaRect = gameArea.getBoundingClientRect();
        const maxTries = 100; // Increased from 50 to ensure finding a spot
        let tries = 0;
        
        const barcodeWidth = 260;
        const barcodeHeight = 200;
        const margin = 20;
        
        while (tries < maxTries) {
            const left = Math.random() * (areaRect.width - barcodeWidth);
            const top = Math.random() * (areaRect.height - barcodeHeight);
            
            // Check for overlap with ALL existing elements (both barcodes and bonus QRs)
            const overlap = Array.from(gameArea.children).some(existing => {
                const rect = existing.getBoundingClientRect();
                const existingLeft = rect.left - areaRect.left;
                const existingTop = rect.top - areaRect.top;
                
                return !(left + barcodeWidth + margin < existingLeft || 
                        left > existingLeft + rect.width + margin || 
                        top + barcodeHeight + margin < existingTop || 
                        top > existingTop + rect.height + margin);
            });
            
            if (!overlap) {
                return { left, top };
            }
            
            tries++;
        }
        
        // If we couldn't find a spot after maxTries, return null
        // This will prevent spawning instead of allowing overlap
        return null;
    }

    startTimer() {
        // Clear any existing interval
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        this.timerInterval = setInterval(() => {
            if (!this.isPaused) {  // Only countdown if not paused
                this.timeRemaining--;
                document.getElementById('timerValue').textContent = this.timeRemaining;
                
                if (this.timeRemaining <= 0) {
                    if (this.round >= this.totalRounds) {
                        this.endGame();
                    } else {
                        this.endRound();
                    }
                }
            }
        }, 1000);
    }

    endRound() {
        clearInterval(this.timerInterval);
        clearInterval(this.barcodeInterval);
        
        // Clear regular barcodes
        const gameArea = document.getElementById('gameArea');
        while (gameArea.firstChild) {
            gameArea.removeChild(gameArea.firstChild);
        }

        // Start bonus round
        this.startBonusRound();
    }

    startBonusRound() {
        this.bonusActive = true;
        this.bonusCodesScanned = 0;
        this.timeRemaining = this.bonusLength;
        
        // Clear any remaining regular barcodes
        while (this.gameArea.firstChild) {
            this.gameArea.removeChild(this.gameArea.firstChild);
        }
        
        // Spawn bonus QR codes
        for (let i = 0; i < this.bonusCodesTotal; i++) {
            this.spawnBonusQR();
        }

        // Start bonus timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        this.timerInterval = setInterval(() => {
            if (this.isPaused) return;
            
            this.timeRemaining--;
            document.getElementById('timerValue').textContent = this.timeRemaining;
            
            if (this.timeRemaining <= 0 || this.bonusCodesScanned === this.bonusCodesTotal) {
                this.endBonusRound();
            }
        }, 1000);
    }

    spawnBonusQR() {
        const gameArea = document.getElementById('gameArea');
        const qrCode = document.createElement('div');
        qrCode.className = 'barcode bonus-qr';
        
        // Generate random position
        const position = this.getRandomPosition(gameArea);
        qrCode.style.left = position.left + 'px';
        qrCode.style.top = position.top + 'px';

        // Random initial velocity (3x faster: 6-12 pixels per frame)
        qrCode.dataset.velocityX = (Math.random() * 6 + 6) * (Math.random() < 0.5 ? -1 : 1) + 'px';
        qrCode.dataset.velocityY = (Math.random() * 6 + 6) * (Math.random() < 0.5 ? -1 : 1) + 'px';

        // Set dimensions for collision detection
        qrCode.dataset.width = '260';  // Match the barcode width
        qrCode.dataset.height = '200'; // Match the barcode height

        // Create QR code content
        const value = Math.floor(Math.random() * 9000 + 1000).toString();
        qrCode.dataset.value = value;
        
        const qrContent = document.createElement('div');
        qrContent.className = 'barcode-content';
        qrContent.innerHTML = `
            <div class="barcode-image" style="${this.generateBarcodePattern(value)}"></div>
            <div class="barcode-text">${value}</div>
        `;
        
        qrCode.appendChild(qrContent);
        gameArea.appendChild(qrCode);

        this.animateQR(qrCode);
    }

    animateQR(qrCode) {
        const gameArea = document.getElementById('gameArea');
        const gameAreaRect = gameArea.getBoundingClientRect();

        const animate = () => {
            if (!this.bonusActive || !qrCode.parentNode) return;

            const rect = qrCode.getBoundingClientRect();
            let velocityX = parseFloat(qrCode.dataset.velocityX);
            let velocityY = parseFloat(qrCode.dataset.velocityY);
            
            let left = rect.left - gameAreaRect.left;
            let top = rect.top - gameAreaRect.top;

            // Check collision with other QR codes
            const otherQRs = Array.from(gameArea.getElementsByClassName('bonus-qr'))
                .filter(other => other !== qrCode);

            for (const other of otherQRs) {
                const otherRect = other.getBoundingClientRect();
                const otherLeft = otherRect.left - gameAreaRect.left;
                const otherTop = otherRect.top - gameAreaRect.top;

                // Check for collision
                if (!(left + rect.width < otherLeft || 
                      left > otherLeft + otherRect.width || 
                      top + rect.height < otherTop || 
                      top > otherTop + otherRect.height)) {
                    
                    // Collision detected - swap velocities
                    const otherVX = parseFloat(other.dataset.velocityX);
                    const otherVY = parseFloat(other.dataset.velocityY);
                    
                    qrCode.dataset.velocityX = otherVX;
                    qrCode.dataset.velocityY = otherVY;
                    other.dataset.velocityX = velocityX;
                    other.dataset.velocityY = velocityY;
                    
                    // Add a small random adjustment to prevent sticking
                    velocityX = otherVX + (Math.random() - 0.5);
                    velocityY = otherVY + (Math.random() - 0.5);
                }
            }

            // Bounce off edges
            if (left <= 0 || left + rect.width >= gameAreaRect.width) {
                velocityX *= -1;
                qrCode.dataset.velocityX = velocityX;
            }
            if (top <= 0 || top + rect.height >= gameAreaRect.height) {
                velocityY *= -1;
                qrCode.dataset.velocityY = velocityY;
            }

            qrCode.style.left = (left + velocityX) + 'px';
            qrCode.style.top = (top + velocityY) + 'px';

            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    endBonusRound() {
        this.bonusActive = false;
        clearInterval(this.timerInterval);
        
        // Calculate and apply bonus
        this.roundMultiplier = this.bonusCodesScanned === this.bonusCodesTotal ? 2 : 1;
        const roundScore = this.score - this.previousRoundScore;
        this.score = this.previousRoundScore + (roundScore * this.roundMultiplier);
        
        // Clear bonus QR codes
        while (this.gameArea.firstChild) {
            this.gameArea.removeChild(this.gameArea.firstChild);
        }

        if (this.round >= this.totalRounds) {
            this.endGame();
        } else {
            this.showRoundStats();
        }
    }

    endGame() {
        this.isPlaying = false;
        this.isGameOver = true;
        
        // Clear all intervals
        clearInterval(this.timerInterval);
        clearInterval(this.barcodeInterval);
        
        // Clear game area
        while (this.gameArea.firstChild) {
            this.gameArea.removeChild(this.gameArea.firstChild);
        }
        
        // Update display
        document.getElementById('gameScreen').classList.add('hidden');
        document.getElementById('gameOver').classList.remove('hidden');
        document.getElementById('finalScore').textContent = this.score;
    }

    startNextRound() {
        this.round++;
        this.timeRemaining = this.roundLength;
        this.goodWhacks = 0;
        this.badWhacks = 0;
        
        document.getElementById('roundStats').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
        this.startRound();
    }

    showRoundStats() {
        const accuracy = Math.round((this.goodWhacks / (this.goodWhacks + this.badWhacks)) * 100) || 0;
        document.getElementById('accuracyValue').textContent = accuracy;
        document.getElementById('goodWhacks').textContent = this.goodWhacks;
        document.getElementById('badWhacks').textContent = this.badWhacks;
        
        // Add bonus round stats
        document.getElementById('bonusScanned').textContent = this.bonusCodesScanned;
        document.getElementById('bonusTotal').textContent = this.bonusCodesTotal;
        document.getElementById('multiplier').textContent = this.roundMultiplier + 'x';

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
        // Reset all game state
        this.score = 0;
        this.round = 1;
        this.timeRemaining = this.roundLength;
        this.goodWhacks = 0;
        this.badWhacks = 0;
        this.previousRoundScore = 0;
        this.bonusActive = false;
        this.bonusCodesScanned = 0;
        this.isPlaying = false;
        this.isGameOver = false;
        this.isPaused = false;
        
        // Clear intervals
        clearInterval(this.timerInterval);
        clearInterval(this.barcodeInterval);
        
        // Reset UI
        document.getElementById('gameOver').classList.add('hidden');
        document.getElementById('roundStats').classList.add('hidden');
        document.getElementById('menuScreen').classList.remove('hidden');
        
        this.updateDisplay();
    }

    updateDisplay() {
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('roundValue').textContent = `${this.round}/${this.totalRounds}`;
        document.getElementById('timerValue').textContent = this.timeRemaining;
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
}); 
