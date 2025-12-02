<script lang="ts">
    import Swal from 'sweetalert2';
    import { onMount } from 'svelte';

    let pins = ['','','','',''];
    let inputRefs: HTMLInputElement[] = [];

    function handleInput(index: number, event: Event) {
        const input = event.target as HTMLInputElement;
        const value = input.value;

        if (!/^\d*$/.test(value)) {
            pins[index] = '';
            return;
        }

        pins[index] = value;

        if (value.length === 1 && index < 4) {
            inputRefs[index + 1]?.focus();
        }
    }

    function handleKeydown(index: number, event: KeyboardEvent) {
        if (event.key === 'Backspace') {
            if (!pins[index] && index > 0) {
                inputRefs[index - 1]?.focus();
            }
        }
    }

    function handleVerify() {
        const finalPin = pins.join('');

        if (finalPin.length === 5) {
            Swal.fire({
                title: 'Verifying...',
                text: `Checking code: ${finalPin}`,
                icon: 'info',
                width: '320px',
                padding: '1.5rem',
                iconColor: '#10B981',
                timer: 1500,
                showConfirmButton: false,
                customClass: { popup: 'my-swal-popup' }
            }).then(() => {
                console.log("Proceed to API...");
            });
        } else {
            Swal.fire({
                title: 'Incomplete Code',
                text: 'Please enter the full 5-digit code.',
                icon: 'warning',
                width: '320px',
                padding: '1.5rem',
                confirmButtonText: 'OK',
                iconColor: '#B4151D',
                confirmButtonColor: '#B4151D',
                customClass: { popup: 'my-swal-popup' }
            });
        }
    }
</script>

<div class="app-screen">
    
    <div class="glass-header">
        <a href="/home" class="back-btn" aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
        </a>
        <h1 class="page-title">VERIFY CODE</h1>
    </div>

    <div class="scroll-container">
        <div class="content-wrapper">
            
            <div class="verify-card">
                <div class="card-header-wrapper">
                    <h2 class="card-title">Verify Participant</h2>
                </div>

                <p class="card-desc">Enter the participant's PIN code.</p>

                <div class="pin-section">
                    <h3 class="input-label">PIN CODE</h3>
                    <div class="pin-inputs-wrapper">
                        {#each pins as _, i}
                            <input 
                                type="text" 
                                inputmode="numeric" 
                                maxlength="1"
                                class="pin-box"
                                bind:value={pins[i]}
                                bind:this={inputRefs[i]}
                                on:input={(e) => handleInput(i, e)}
                                on:keydown={(e) => handleKeydown(i, e)}
                            />
                        {/each}
                    </div>
                </div>

                <button class="submit-btn" on:click={handleVerify}>
                    VERIFY
                </button>
            </div>

        </div>
    </div>
</div>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    :global(body) {
        margin: 0; padding: 0;
        background-color: #111827; 
        font-family: 'Inter', sans-serif;
        overflow: hidden; 
    }

    .app-screen {
        height: 100vh;
        display: flex;
        flex-direction: column;
        position: relative;
    }

    .glass-header {
        position: absolute;
        top: 0; left: 0; width: 100%;
        height: 80px; 
        z-index: 50;
        background: rgba(17, 24, 39, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .back-btn {
        position: absolute; left: 20px;
        width: 36px; height: 36px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        display: flex; align-items: center; justify-content: center;
        color: white; cursor: pointer; transition: 0.2s;
    }
    .back-btn:hover { background: rgba(255, 255, 255, 0.2); }

    .page-title {
        color: white; font-size: 28px; font-weight: 700; 
        margin: 0; letter-spacing: 1px;
        text-transform: uppercase;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }

    .scroll-container {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        padding-top: 100px; 
        padding-bottom: 40px;
    }
    .scroll-container::-webkit-scrollbar { display: none; }

    .content-wrapper {
        width: 100%; max-width: 400px; margin: 0 auto; padding: 0 20px; box-sizing: border-box;
        display: flex; flex-direction: column; align-items: center;
    }

    .verify-card {
        background: white;
        width: 100%;
        max-width: 350px; 
        border-radius: 20px;
        padding: 30px 24px;
        box-sizing: border-box;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        text-align: center;
    }

    .card-header-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
    }

    .card-title {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: #111827;
    }

    .card-desc {
        color: #6B7280;
        font-size: 14px;
        margin: 0 0 30px 0;
    }

    .input-label {
        font-size: 12px;
        font-weight: 700;
        color: #374151;
        margin-bottom: 12px;
        text-transform: uppercase;
        display: block;
    }

    .pin-inputs-wrapper {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-bottom: 30px;
    }

    .pin-box {
        width: 100%; 
        max-width: 50px;
        height: 54px;
        border: 2px solid #374151;
        border-radius: 10px;
        text-align: center;
        font-size: 24px;
        font-weight: 600;
        color: #111827;
        background: #F9FAFB;
        outline: none;
        padding: 0;
        transition: all 0.2s;
    }
    .pin-box:focus {
        border-color: #10B981;
        box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
        background: white;
    }

    .submit-btn {
        width: 100%; 
        background-color: #10B981;
        color: #111827; 
        border: none;
        padding: 14px;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
        text-transform: uppercase;
        font-family: 'Inter', sans-serif;
    }
    .submit-btn:hover {
        background-color: #059669;
    }

    :global(.swal2-container) {
        backdrop-filter: blur(5px);
        background: rgba(0, 0, 0, 0.4) !important;
    }
    :global(.my-swal-popup) {
        font-family: 'Inter', sans-serif !important;
        border-radius: 20px !important;
    }
    :global(.swal2-title) {
        font-size: 1.25rem !important;
        color: #111827 !important;
    }

    @media (max-width: 380px) {
        .pin-box { height: 48px; font-size: 20px; }
        .verify-card { padding: 24px 16px; }
    }
</style>