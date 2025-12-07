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
    font-family: 'Georgia', 'Times New Roman', serif;
    background: #fafaf8;
    min-height: 100vh;
  }

  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 40px 20px;
    min-height: 100vh;
  }

  /* Header */
  header {
    text-align: center;
    margin-bottom: 60px;
    padding-bottom: 30px;
    border-bottom: 1px solid #d4d4d0;
  }

  h1 {
    margin: 0 0 12px 0;
    font-size: 2.5rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    color: #1a1a1a;
    font-family: 'Georgia', serif;
  }

  header p {
    margin: 0;
    font-size: 0.95rem;
    color: #6b6b68;
    font-weight: 400;
    letter-spacing: 0.01em;
  }

  /* Container */
  .container {
    padding: 0;
    min-height: 300px;
  }

  /* Upload section */
  .upload-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    text-align: center;
    padding: 80px 20px;
  }

  #imageInput {
    display: none;
  }

  .upload-button {
    display: inline-block;
    background: #1a1a1a;
    color: #fafaf8;
    padding: 16px 48px;
    font-size: 0.95rem;
    font-weight: 400;
    letter-spacing: 0.05em;
    border: 1px solid #1a1a1a;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
  }

  .upload-button:hover {
    background: transparent;
    color: #1a1a1a;
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
    overflow: visible;
    border: 1px solid #e5e5e3;
  }

  .image-container img {
    width: 100%;
    display: block;
    max-height: 80vh;
    object-fit: contain;
    background: #ffffff;
  }

  /* Overlay messages (processing, error, no matches) */
  .overlay-message {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 255, 255, 0.98);
    padding: 40px;
    text-align: center;
    border: 1px solid #e5e5e3;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    max-width: 400px;
    z-index: 10;
  }

  .overlay-message p {
    margin: 12px 0;
    color: #1a1a1a;
    font-weight: 400;
  }

  .overlay-message .hint {
    font-size: 0.85rem;
    color: #6b6b68;
    font-weight: 400;
  }

  .spinner {
    width: 40px;
    height: 40px;
    margin: 0 auto 24px;
    border: 2px solid #e5e5e3;
    border-top: 2px solid #1a1a1a;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-overlay p:first-child {
    color: #1a1a1a;
    font-size: 1rem;
    font-weight: 500;
  }

  .error-overlay button {
    margin-top: 20px;
    padding: 12px 32px;
    background: #1a1a1a;
    color: #fafaf8;
    border: 1px solid #1a1a1a;
    font-size: 0.9rem;
    font-weight: 400;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
  }

  .error-overlay button:hover {
    background: transparent;
    color: #1a1a1a;
  }

  /* Markers */
  .marker {
    position: absolute;
    width: 32px;
    height: 32px;
    transform: translate(-50%, -50%);
    background: #1a1a1a;
    color: #fafaf8;
    border: 2px solid #fafaf8;
    border-radius: 50%;
    font-size: 0.85rem;
    font-weight: 400;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .marker:hover {
    transform: translate(-50%, -50%) scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .marker.active {
    background: #fafaf8;
    color: #1a1a1a;
    border-color: #1a1a1a;
    transform: translate(-50%, -50%) scale(1.1);
  }

  /* Popup */
  .popup {
    position: absolute;
    transform: translate(-50%, calc(-100% - 40px));
    background: #ffffff;
    padding: 24px;
    max-width: 300px;
    min-width: 260px;
    z-index: 15;
    border: 1px solid #d4d4d0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    animation: popupAppear 0.2s ease-out;
  }

  @keyframes popupAppear {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-100% - 35px));
    }
    to {
      opacity: 1;
      transform: translate(-50%, calc(-100% - 40px));
    }
  }

  .popup::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid #ffffff;
  }

  .popup-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    font-size: 1.3rem;
    line-height: 1;
    cursor: pointer;
    color: #9b9b98;
    transition: color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .popup-close:hover {
    color: #1a1a1a;
  }

  .popup h3 {
    margin: 0 0 16px 0;
    font-size: 1.15rem;
    font-weight: 500;
    color: #1a1a1a;
    padding-right: 24px;
    letter-spacing: 0.01em;
    font-family: 'Georgia', serif;
  }

  .popup p {
    margin: 0;
    color: #6b6b68;
    line-height: 1.7;
    font-size: 0.9rem;
    font-weight: 400;
  }

  /* Info hint */
  .info-hint {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(26, 26, 26, 0.85);
    color: #fafaf8;
    padding: 8px 20px;
    font-size: 0.8rem;
    font-weight: 400;
    letter-spacing: 0.02em;
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
    min-width: 200px;
    padding: 14px 40px;
    background: #1a1a1a;
    color: #fafaf8;
    border: 1px solid #1a1a1a;
    font-size: 0.9rem;
    font-weight: 400;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    margin-top: 32px;
  }

  .reset-button:hover {
    background: transparent;
    color: #1a1a1a;
  }

  /* Footer */
  footer {
    text-align: center;
    margin-top: 60px;
    padding-top: 30px;
    border-top: 1px solid #d4d4d0;
    color: #9b9b98;
    font-size: 0.85rem;
    font-weight: 400;
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
