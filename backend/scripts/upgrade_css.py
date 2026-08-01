import sys
import re

def upgrade_css():
    file_path = '/home/smartgate/BioFace/backend/static/telegram_webapp/index.html'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    pro_css = """
  <!-- PRO DESIGN UPGRADE STYLES & SCRIPTS -->
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    /* Premium Font & Base Overrides */
    body {
      font-family: 'Outfit', 'Plus Jakarta Sans', sans-serif !important;
      background: radial-gradient(circle at 10% 20%, #0f172a 0%, #020617 90%) !important;
      color: #f8fafc;
      letter-spacing: -0.01em;
      transition: background 0.5s ease;
    }
    body.light-theme {
      background: radial-gradient(circle at 10% 20%, #ffffff 0%, #f1f5f9 90%) !important;
    }

    /* Enhanced Glassmorphism for Cards */
    .glass-card {
      background: rgba(15, 23, 42, 0.45) !important;
      backdrop-filter: blur(28px) saturate(190%) !important;
      -webkit-backdrop-filter: blur(28px) saturate(190%) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
      border-radius: 24px !important;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease !important;
    }
    body.light-theme .glass-card {
      background: rgba(255, 255, 255, 0.75) !important;
      border: 1px solid rgba(0, 0, 0, 0.04) !important;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 1) !important;
    }

    /* Hover and Click Micro-interactions for Cards */
    .glass-card:active {
      transform: scale(0.96) translateY(2px) !important;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.02) !important;
    }
    
    /* Interactive Button Enhancements */
    .action-btn {
      position: relative;
      overflow: hidden;
      border-radius: 20px !important;
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(2, 132, 199, 0.1)) !important;
      border: 1px solid rgba(56, 189, 248, 0.3) !important;
      box-shadow: 0 4px 20px rgba(2, 132, 199, 0.15) !important;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
      transform: translateZ(0);
    }
    .action-btn:active {
      transform: scale(0.94) !important;
      background: rgba(56, 189, 248, 0.25) !important;
      box-shadow: 0 2px 10px rgba(2, 132, 199, 0.2) !important;
    }
    .action-btn::after {
      content: '';
      position: absolute;
      top: 0; left: -100%;
      width: 50%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
      animation: shine 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    @keyframes shine {
      0% { left: -100%; }
      20% { left: 200%; }
      100% { left: 200%; }
    }

    /* Check-in/Check-out Main Buttons */
    #btn-checkin, #btn-checkout {
      border-radius: 50% !important;
      box-shadow: 0 15px 35px rgba(0,0,0,0.35), inset 0 2px 5px rgba(255,255,255,0.2) !important;
      transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease !important;
      will-change: transform;
    }
    #btn-checkin:active, #btn-checkout:active {
      transform: scale(0.88) !important;
      box-shadow: 0 5px 15px rgba(0,0,0,0.25), inset 0 1px 2px rgba(255,255,255,0.1) !important;
    }
    #btn-checkin::before, #btn-checkout::before {
      content: '';
      position: absolute;
      top: -10px; left: -10px; right: -10px; bottom: -10px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.1);
      animation: pulse-ring 2.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
      z-index: -1;
    }
    @keyframes pulse-ring {
      0% { transform: scale(0.9); opacity: 1; border-width: 3px; }
      100% { transform: scale(1.3); opacity: 0; border-width: 0px; }
    }

    /* Floating Navigation Bar Premium */
    .nav-bar {
      background: rgba(15, 23, 42, 0.7) !important;
      backdrop-filter: blur(40px) saturate(200%) !important;
      -webkit-backdrop-filter: blur(40px) saturate(200%) !important;
      border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
      box-shadow: 0 -15px 50px rgba(0, 0, 0, 0.4) !important;
      border-radius: 30px 30px 0 0 !important;
      padding-bottom: calc(var(--safe-bottom) + 12px) !important;
      transition: background 0.3s ease, border-color 0.3s ease;
    }
    body.light-theme .nav-bar {
      background: rgba(255, 255, 255, 0.85) !important;
      border-top: 1px solid rgba(0, 0, 0, 0.05) !important;
      box-shadow: 0 -15px 50px rgba(0, 0, 0, 0.08) !important;
    }

    .nav-item {
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
      position: relative;
    }
    .nav-item.active {
      transform: translateY(-6px) !important;
    }
    .nav-item.active .nav-icon {
      color: var(--accent) !important;
      filter: drop-shadow(0 6px 12px rgba(56, 189, 248, 0.5));
      transform: scale(1.1);
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.4s ease;
    }
    .nav-item.active::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 12px 2px var(--accent);
      animation: popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes popIn {
      0% { transform: translate(-50%, 10px) scale(0); opacity: 0; }
      100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
    }

    /* Skeleton Loading Shimmer Animation */
    .skeleton-text, .skeleton-block {
      background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.04) 75%) !important;
      background-size: 400% 100% !important;
      animation: skeleton-shimmer 1.5s ease-in-out infinite !important;
      border-radius: 12px !important;
    }
    body.light-theme .skeleton-text, body.light-theme .skeleton-block {
      background: linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 75%) !important;
      background-size: 400% 100% !important;
    }
    @keyframes skeleton-shimmer {
      0% { background-position: 100% 50%; }
      100% { background-position: 0 50%; }
    }

    /* Cascade Slide Up Animation for History & List Items */
    .history-item, .stat-value {
      animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      opacity: 0;
      transform: translateY(20px);
      will-change: transform, opacity;
    }
    .history-item:nth-child(1) { animation-delay: 0.1s; }
    .history-item:nth-child(2) { animation-delay: 0.15s; }
    .history-item:nth-child(3) { animation-delay: 0.2s; }
    .history-item:nth-child(4) { animation-delay: 0.25s; }
    .history-item:nth-child(5) { animation-delay: 0.3s; }
    
    @keyframes slideUpFade {
      to { opacity: 1; transform: translateY(0); }
    }

    /* Profile Hero Glow */
    .profile-hero-card {
      position: relative;
      overflow: hidden;
      z-index: 1;
    }
    .profile-hero-card::after {
      content: '';
      position: absolute;
      top: -50%; right: -50%;
      width: 200%; height: 200%;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 60%);
      pointer-events: none;
      z-index: -1;
      animation: ambient-spin 20s linear infinite;
    }
    @keyframes ambient-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Smooth Modal Enhancements */
    .modal-overlay {
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      transition: opacity 0.4s ease, backdrop-filter 0.4s ease !important;
    }
    .modal-content {
      border: 1px solid rgba(255,255,255,0.1) !important;
      box-shadow: 0 25px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1) !important;
      transform: scale(0.92) translateY(30px);
      transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      border-radius: 28px !important;
    }
    .modal-overlay[style*="display: flex"] .modal-content {
      transform: scale(1) translateY(0);
    }
    body.light-theme .modal-content {
      box-shadow: 0 25px 60px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,1) !important;
      border: 1px solid rgba(0,0,0,0.05) !important;
    }

    /* Typographic Gradients */
    .stat-value {
      font-weight: 800 !important;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 2px 10px rgba(255,255,255,0.1);
    }
    body.light-theme .stat-value {
      background: linear-gradient(135deg, #0f172a 0%, #475569 100%);
      text-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }

    /* Dropdown UI Pro */
    .profile-dropdown {
      border-radius: 24px !important;
      box-shadow: 0 15px 50px rgba(0,0,0,0.5) !important;
      backdrop-filter: blur(32px) saturate(200%) !important;
      -webkit-backdrop-filter: blur(32px) saturate(200%) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }
    body.light-theme .profile-dropdown {
      box-shadow: 0 15px 50px rgba(0,0,0,0.1) !important;
      border: 1px solid rgba(0, 0, 0, 0.05) !important;
    }
  </style>
  <script>
    // Ripple Effect Script for Buttons
    document.addEventListener("DOMContentLoaded", () => {
      const attachRipples = () => {
        document.querySelectorAll(".action-btn, .glass-card[onclick], .nav-item").forEach(btn => {
          if(!btn.dataset.rippleAttached) {
            btn.dataset.rippleAttached = "true";
            btn.addEventListener("pointerdown", function(e) {
              const rect = this.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const ripple = document.createElement("span");
              ripple.style.position = "absolute";
              ripple.style.background = "rgba(255, 255, 255, 0.2)";
              ripple.style.borderRadius = "50%";
              ripple.style.pointerEvents = "none";
              ripple.style.transform = "translate(-50%, -50%) scale(0)";
              ripple.style.animation = "ripple-anim 0.6s linear";
              ripple.style.width = ripple.style.height = Math.max(rect.width, rect.height) * 2 + "px";
              ripple.style.left = x + "px";
              ripple.style.top = y + "px";
              this.appendChild(ripple);
              setTimeout(() => ripple.remove(), 600);
            });
          }
        });
      };
      
      const style = document.createElement("style");
      style.innerHTML = `
        @keyframes ripple-anim {
          to { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
        .action-btn, .glass-card[onclick], .nav-item { position: relative; overflow: hidden; }
      `;
      document.head.appendChild(style);
      
      attachRipples();
      
      // Re-attach ripples when DOM changes (e.g. History items loaded)
      const observer = new MutationObserver(attachRipples);
      observer.observe(document.body, { childList: true, subtree: true });
    });
  </script>
  </head>
"""

    # We want to replace the previously injected styles or insert if not exists
    if "<!-- PRO DESIGN UPGRADE STYLES -->" in content:
        # Remove old injected block
        content = re.sub(r'<!-- PRO DESIGN UPGRADE STYLES -->.*?</style>\s*</head>', '</head>', content, flags=re.DOTALL)
        
    if "<!-- PRO DESIGN UPGRADE STYLES & SCRIPTS -->" not in content:
        content = content.replace("</head>", pro_css)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("✅ Premium PRO UI effects & scripts successfully applied.")
    else:
        print("✅ PRO UI already exists.")

if __name__ == "__main__":
    upgrade_css()
