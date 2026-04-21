import confetti from "canvas-confetti";

export function fireConfetti() {
  const colors = ["#ff5e7a", "#3fc9d4", "#ffcd3c", "#b07cff"];

  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 },
    colors,
  });

  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.65 },
      colors,
    });
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.65 },
      colors,
    });
  }, 220);
}
