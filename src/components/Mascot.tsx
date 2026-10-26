import standing from "../assets/mascots/standing.png";
import waving from "../assets/mascots/waving.png";
import joy from "../assets/mascots/joy.png";
import thinking from "../assets/mascots/thinking.png";
import reading from "../assets/mascots/reading.png";
import mining from "../assets/mascots/mining.png";
import clasped from "../assets/mascots/clasped.png";
import holographic from "../assets/mascots/holographic.png";

export type MascotPose =
  | "standing"
  | "waving"
  | "joy"
  | "thinking"
  | "reading"
  | "mining"
  | "clasped"
  | "holographic";

const POSE_SRC: Record<MascotPose, string> = {
  standing,
  waving,
  joy,
  thinking,
  reading,
  mining,
  clasped,
  holographic,
};

/** Дефолтные реплики по позе (used when caller passes no message) */
export const MASCOT_PHRASES: Record<MascotPose, string> = {
  standing: "Выбрано. Я всё проверила — заглянула за лупу и под грядки",
  waving: "Привет! Чего запускаем сегодня?",
  joy: "Готова к посадке! Погнали играть",
  thinking: "Хм... может добавить пару модов?",
  reading: "Так, в changelog пишут: быстрее поиск модов",
  mining: "Сую за новой версией... терпение",
  clasped: "Ох, только без вылетов, пожалуйста",
  holographic: "Системные настройки открыты: Java 21, RAM 6 ГБ",
};

export const MASCOT_CAPTIONS: Record<MascotPose, string> = {
  standing: "проверка / диагностика",
  waving: "приветствие",
  joy: "запуск игры",
  thinking: "выбор сборки",
  reading: "changelog / гайд",
  mining: "загрузка",
  clasped: "ожидание",
  holographic: "настройки / тех-режим",
};

export { POSE_SRC };

export type MascotProps = {
  pose: MascotPose;
  /** Text for the speech bubble. Falls back to MASCOT_PHRASES[pose]. */
  message?: string | null;
  /** Image width in px (height auto). */
  size?: number;
  /** Optional footer caption under the panda. */
  showCaption?: boolean;
};

/**
 * Speech-bubble + panda image. Must live in its own layout column
 * (never absolutely positioned over content).
 */
export default function Mascot({
  pose,
  message,
  size = 132,
  showCaption = false,
}: MascotProps) {
  const text = (message && message.trim()) || MASCOT_PHRASES[pose];
  return (
    <div className="rp-mascot">
      <div className="rp-mascot-bubble" key={`b-${text}`}>{text}</div>
      <img
        key={pose}
        className="rp-mascot-img"
        src={POSE_SRC[pose]}
        alt={`RedPanda mascot — ${pose}`}
        style={{ width: size }}
        draggable={false}
      />
      {showCaption && (
        <div className="rp-mascot-caption" key={`c-${pose}`}>
          <b>{pose}</b> · {MASCOT_CAPTIONS[pose]}
        </div>
      )}
    </div>
  );
}
