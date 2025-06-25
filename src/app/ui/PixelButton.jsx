import React from "react";
import "./PixelUI.css";

const PixelButton = ({
  text,
  size = "medium",
  onClick,
  children,
  className = "",
  style,
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case "small":
        return "px-4 py-2 text-xs";
      case "medium":
        return "px-6 py-3 text-base";
      case "large":
        return "px-8 py-4 text-lg";
      default:
        return "px-6 py-3 text-base";
    }
  };
  return (
    <button
      onClick={onClick}
      className={`
        ${getSizeClasses()} pixel-btn pixelated-font font-bold tracking-wider select-none rounded-none uppercase
        bg-[#223a7a] text-[#ffd600] border-4 border-[#ffd600] shadow-lg
        ${className}
      `}
      style={{ ...style, textShadow: "2px 2px 0 #23234c" }}
    >
      {text || children}
    </button>
  );
};

export default PixelButton;
