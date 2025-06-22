import React from "react";
import "./PixelUI.css";

const PixelButton = ({ children, onClick, style, className }) => (
  <button
    className={`pixel-button ${className || ""}`}
    style={style}
    onClick={onClick}
  >
    {children}
  </button>
);

export default PixelButton;
