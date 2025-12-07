<script>
  // State variables
  let imageFile = null;
  let imagePreview = null;
  let isProcessing = false;
  let matchedTerms = [];
  let selectedTerm = null;
  let error = null;

  // Handle image upload from file input
  async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset state
    imageFile = file;
    error = null;
    matchedTerms = [];
    selectedTerm = null;

    // Wait for preview to load first
    try {
      imagePreview = await fileToBase64(file);
    } catch (err) {
      error = 'Failed to read image file. Please try another file.';
      imageFile = null;
      return;
    }

    // Then process with Claude vision
    await processImage(file);
  }

  // Process image by calling our backend API
  async function processImage(file) {
    isProcessing = true;
    error = null;

    try {
      // Validate file type
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validImageTypes.includes(file.type)) {
        error = 'Please upload a valid image file (JPEG, PNG, GIF, or WebP).';
        isProcessing = false;
        return;
      }

      // Convert file to base64
      const base64Image = await fileToBase64(file);
      const base64Data = base64Image.split(',')[1]; // Remove data:image/jpeg;base64, prefix

      // Call our backend API (no CORS issues!)
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: base64Data,
          mediaType: file.type
        })
      });

      const data = await response.json();

      if (!response.ok) {
        error = data.error || 'Failed to analyze image. Please try again.';
        isProcessing = false;
        return;
      }

      // Extract response from backend
      const message = data.response;

      // Validate response structure
      if (!message.content || !message.content[0] || !message.content[0].text) {
        error = 'Unexpected response format from API.';
        isProcessing = false;
        return;
      }

      const responseText = message.content[0].text;
      console.log('Claude response:', responseText);

      // Extract and parse JSON safely
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Validate structure - now requires position data
          if (Array.isArray(parsed) && parsed.every(item =>
            item.name && item.definition && item.position &&
            typeof item.position.x === 'number' && typeof item.position.y === 'number'
          )) {
            matchedTerms = parsed;
          } else {
            console.warn('Invalid dish structure in response:', parsed);
            matchedTerms = [];
          }
        } else {
          matchedTerms = [];
        }
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
        console.error('Raw response:', responseText);
        matchedTerms = [];
        error = 'Failed to parse response. Please try again.';
      }

    } catch (err) {
      console.error('API Error:', err);
      error = err.message || 'Failed to analyze image. Please try again.';
    } finally {
      isProcessing = false;
    }
  }

  // Helper function to convert File to base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }


  // Select a term to show its definition
  function selectTerm(term) {
    selectedTerm = selectedTerm === term ? null : term;
  }

  // Reset to initial state
  function reset() {
    imageFile = null;
    imagePreview = null;
    isProcessing = false;
    matchedTerms = [];
    selectedTerm = null;
    error = null;
  }
</script>

<main>
  <header>
    <h1>Menu Translator</h1>
    <p>Upload a menu photo to identify and explain dishes from any cuisine</p>
  </header>

  <div class="container">
    {#if !imagePreview}
      <!-- Initial upload state -->
      <div class="upload-section">
        <label for="imageInput" class="upload-button">
          Analyze Menu Photo
        </label>
        <input
          id="imageInput"
          type="file"
          accept="image/*"
          capture="environment"
          on:change={handleImageUpload}
        />
      </div>
    {:else}
      <!-- Image preview and interactive markers -->
      <div class="results-section">
        <div class="image-container">
          <img src={imagePreview} alt="Menu preview" />

          {#if isProcessing}
            <div class="overlay-message">
              <div class="spinner"></div>
              <p>Analyzing menu with AI...</p>
              <p class="hint">This may take a few seconds</p>
            </div>
          {:else if error}
            <div class="overlay-message error-overlay">
              <p>{error}</p>
              <button on:click={reset}>Try Another Photo</button>
            </div>
          {:else if matchedTerms.length > 0}
            <!-- Clickable markers for each dish -->
            {#each matchedTerms as term, index}
              <button
                class="marker"
                class:active={selectedTerm === term}
                style="left: {term.position.x}%; top: {term.position.y}%;"
                on:click={() => selectTerm(term)}
                aria-label="View {term.name}"
              >
                {index + 1}
              </button>
            {/each}

            <!-- Popup for selected term -->
            {#if selectedTerm}
              <div
                class="popup"
                style="left: {selectedTerm.position.x}%; top: {selectedTerm.position.y}%;"
              >
                <button class="popup-close" on:click={() => selectedTerm = null}>×</button>
                <h3>{selectedTerm.name}</h3>
                <p>{selectedTerm.definition}</p>
              </div>
            {/if}

            <!-- Info hint -->
            <div class="info-hint">
              Click the numbered markers to learn about each dish
            </div>
          {:else}
            <div class="overlay-message">
              <p>No dishes identified in this image.</p>
              <p class="hint">Make sure the photo is clear and shows menu items with dish names.</p>
            </div>
          {/if}
        </div>

        {#if !isProcessing}
          <button class="reset-button" on:click={reset}>
            Analyze Another Photo
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <footer>
    <p>HorizonRuler 2025</p>
  </footer>
</main>

<style>
  /* Global styles */
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background:
      radial-gradient(circle at 20% 50%, rgba(255, 107, 107, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(255, 127, 80, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 40% 20%, rgba(238, 90, 111, 0.08) 0%, transparent 50%),
      linear-gradient(135deg, #fff5f0 0%, #ffe8e0 50%, #fff0e8 100%);
    background-size: 100% 100%;
    animation: backgroundShift 20s ease infinite;
    min-height: 100vh;
  }

  @keyframes backgroundShift {
    0%, 100% {
      background-position: 0% 0%, 100% 100%, 50% 20%, 0% 0%;
    }
    50% {
      background-position: 100% 100%, 0% 0%, 80% 50%, 0% 0%;
    }
  }

  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
    position: relative;
  }

  /* Decorative background elements */
  main::before,
  main::after {
    content: '';
    position: fixed;
    border-radius: 50%;
    opacity: 0.03;
    pointer-events: none;
    z-index: -1;
  }

  main::before {
    width: 600px;
    height: 600px;
    top: -200px;
    right: -200px;
    background: radial-gradient(circle, #ff6b6b 0%, transparent 70%);
    animation: float1 25s ease-in-out infinite;
  }

  main::after {
    width: 500px;
    height: 500px;
    bottom: -150px;
    left: -150px;
    background: radial-gradient(circle, #ff7f50 0%, transparent 70%);
    animation: float2 20s ease-in-out infinite;
  }

  @keyframes float1 {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    33% { transform: translate(50px, 50px) rotate(120deg); }
    66% { transform: translate(-30px, 80px) rotate(240deg); }
  }

  @keyframes float2 {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    33% { transform: translate(-40px, -40px) rotate(-120deg); }
    66% { transform: translate(60px, -60px) rotate(-240deg); }
  }

  /* Header */
  header {
    text-align: center;
    margin-bottom: 30px;
    padding: 20px;
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 50%, #ff7f50 100%);
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.25);
  }

  h1 {
    margin: 0;
    font-size: 2.2rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: white;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  header p {
    margin: 10px 0 0 0;
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.95);
  }

  /* Container */
  .container {
    border-radius: 16px;
    padding: 30px;
    min-height: 300px;
  }

  /* White container only when showing results */
  .container:has(.results-section) {
    background: white;
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.04);
  }

  /* Upload section */
  .upload-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    text-align: center;
    padding: 60px 20px;
    position: relative;
  }

  /* Decorative food icons */
  .upload-section::before {
    content: '🍽️';
    position: absolute;
    font-size: 120px;
    opacity: 0.04;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    animation: pulse 4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.04; }
    50% { transform: translate(-50%, -50%) scale(1.05); opacity: 0.06; }
  }

  #imageInput {
    display: none;
  }

  .upload-button {
    display: inline-block;
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    color: white;
    padding: 18px 40px;
    font-size: 1.1rem;
    font-weight: 600;
    border-radius: 12px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
  }

  .upload-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
  }

  .upload-button:active {
    transform: scale(0.98);
  }

  /* Results section */
  .results-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
    align-items: center;
  }

  .image-container {
    position: relative;
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  }

  .image-container img {
    width: 100%;
    display: block;
    max-height: 80vh;
    object-fit: contain;
    background: #f8f9fa;
  }

  /* Overlay messages (processing, error, no matches) */
  .overlay-message {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 255, 255, 0.95);
    padding: 32px 40px;
    border-radius: 16px;
    text-align: center;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(10px);
    max-width: 400px;
    z-index: 10;
  }

  .overlay-message p {
    margin: 12px 0;
    color: #374151;
    font-weight: 500;
  }

  .overlay-message .hint {
    font-size: 0.9rem;
    color: #6b7280;
    font-weight: 400;
  }

  .spinner {
    width: 50px;
    height: 50px;
    margin: 0 auto 20px;
    border: 4px solid #ffe8e0;
    border-top: 4px solid #ff6b6b;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-overlay p:first-child {
    color: #ef4444;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .error-overlay button {
    margin-top: 16px;
    padding: 12px 24px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .error-overlay button:hover {
    background: #dc2626;
    transform: translateY(-1px);
  }

  /* Markers */
  .marker {
    position: absolute;
    width: 36px;
    height: 36px;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    color: white;
    border: 3px solid white;
    border-radius: 50%;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4), 0 2px 6px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .marker:hover {
    transform: translate(-50%, -50%) scale(1.15);
    box-shadow: 0 6px 20px rgba(255, 107, 107, 0.5), 0 3px 10px rgba(0, 0, 0, 0.2);
  }

  .marker.active {
    background: linear-gradient(135deg, #ee5a6f 0%, #dc2626 100%);
    transform: translate(-50%, -50%) scale(1.2);
    box-shadow: 0 8px 24px rgba(255, 107, 107, 0.6), 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  /* Popup */
  .popup {
    position: absolute;
    transform: translate(-50%, calc(-100% - 50px));
    background: white;
    padding: 20px 24px;
    border-radius: 16px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.1);
    max-width: 320px;
    min-width: 280px;
    z-index: 15;
    border: 2px solid #ff6b6b;
    animation: popupAppear 0.2s ease-out;
  }

  @keyframes popupAppear {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-100% - 40px)) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translate(-50%, calc(-100% - 50px)) scale(1);
    }
  }

  .popup::after {
    content: '';
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 10px solid #ff6b6b;
  }

  .popup-close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    background: #f3f4f6;
    border: none;
    border-radius: 50%;
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .popup-close:hover {
    background: #e5e7eb;
    color: #374151;
  }

  .popup h3 {
    margin: 0 0 12px 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    padding-right: 24px;
  }

  .popup p {
    margin: 0;
    color: #4b5563;
    line-height: 1.6;
    font-size: 0.95rem;
  }

  /* Info hint */
  .info-hint {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.75);
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 500;
    backdrop-filter: blur(8px);
    z-index: 5;
    animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Reset button */
  .reset-button {
    align-self: center;
    width: auto;
    min-width: 250px;
    padding: 14px 32px;
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
  }

  .reset-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
  }

  .reset-button:active {
    transform: scale(0.98);
  }

  /* Footer */
  footer {
    text-align: center;
    margin-top: 30px;
    color: #9ca3af;
    font-size: 0.9rem;
  }

  /* Mobile responsive */
  @media (max-width: 600px) {
    main {
      padding: 15px;
    }

    .container {
      padding: 20px;
    }

    h1 {
      font-size: 1.6rem;
    }

    .upload-button {
      padding: 14px 28px;
      font-size: 1rem;
    }

    .reset-button {
      width: 100%;
      min-width: auto;
    }

    .image-container {
      border-radius: 8px;
    }

    .marker {
      width: 32px;
      height: 32px;
      font-size: 0.9rem;
    }

    .popup {
      max-width: 260px;
      min-width: 240px;
      padding: 16px 20px;
      font-size: 0.9rem;
    }

    .popup h3 {
      font-size: 1.1rem;
    }

    .info-hint {
      font-size: 0.85rem;
      padding: 8px 16px;
      bottom: 12px;
    }

    .overlay-message {
      padding: 24px 28px;
      max-width: 90%;
    }
  }
</style>
