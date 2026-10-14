/**
 * Trend templates. Each one is a prompt recipe sent to the image-to-video model
 * together with the user's photo. Add, remove or reword freely — the UI renders
 * whatever is in this list.
 */
export interface Trend {
  id: string;
  title: string;
  tagline: string;
  /** Emoji shown on the card */
  icon: string;
  /** Two CSS colors for the card gradient */
  colors: [string, string];
  prompt: string;
  negativePrompt?: string;
}

const IDENTITY =
  "Keep the exact face, hairstyle, skin tone and outfit of the person in the photo. " +
  "Photorealistic, cinematic broadcast-camera look, night match under bright floodlights, " +
  "packed stadium crowd in the background, smooth natural motion, vertical 9:16 framing.";

const NEGATIVE =
  "blurry, distorted face, extra limbs, deformed hands, warped ball, text, watermark, low quality, cartoon";

export const TRENDS: Trend[] = [
  {
    id: "keepy-uppy",
    title: "Keepy-Uppy",
    tagline: "Juggle the ball on the centre circle",
    icon: "⚽",
    colors: ["#1f8f4e", "#0b3d1f"],
    prompt:
      "The person walks onto a professional football pitch and juggles a football with their feet, " +
      "flicks it up and controls it on their head while the crowd cheers. " +
      IDENTITY,
  },
  {
    id: "skill-run",
    title: "Skill Run",
    tagline: "Dribble past a defender",
    icon: "💨",
    colors: ["#2563eb", "#0b1f4d"],
    prompt:
      "The person dribbles a football at speed across a professional pitch, does a quick step-over " +
      "and sprints past a defender in a striped kit, camera tracking alongside. " +
      IDENTITY,
  },
  {
    id: "bicycle-kick",
    title: "Bicycle Kick",
    tagline: "The overhead goal of the season",
    icon: "🚀",
    colors: ["#9333ea", "#2a0b5e"],
    prompt:
      "The person leaps backwards and performs a spectacular bicycle kick, striking the football " +
      "toward the goal; slow-motion moment as the ball flies, then lands safely. " +
      IDENTITY,
  },
  {
    id: "penalty",
    title: "Last-Minute Penalty",
    tagline: "Step up, slot it in the corner",
    icon: "🎯",
    colors: ["#ea580c", "#4a1503"],
    prompt:
      "The person places the ball on the penalty spot, takes a short run-up and calmly shoots into " +
      "the bottom corner of the net past the diving goalkeeper. " +
      IDENTITY,
  },
  {
    id: "celebration",
    title: "Knee-Slide",
    tagline: "Celebrate in front of the fans",
    icon: "🙌",
    colors: ["#e11d48", "#4c0519"],
    prompt:
      "The person runs toward the corner flag and does a joyful knee-slide celebration on the grass " +
      "with arms wide open as the crowd erupts and confetti falls. " +
      IDENTITY,
  },
  {
    id: "trophy",
    title: "Trophy Lift",
    tagline: "Champions under the confetti",
    icon: "🏆",
    colors: ["#ca8a04", "#422006"],
    prompt:
      "The person stands on a podium on the pitch and lifts a shiny golden trophy above their head, " +
      "gold confetti and fireworks, teammates cheering around them. " +
      IDENTITY,
  },
];

export const DEFAULT_NEGATIVE_PROMPT = NEGATIVE;

export function getTrend(id: string): Trend | undefined {
  return TRENDS.find((t) => t.id === id);
}
