import React from "react";
import "./Waveform.css";

type Props = {
    isPlaying: boolean;
};

export function Waveform({ isPlaying }: Props) {
    return (
        <div className={`waveform-container ${isPlaying ? "playing" : "paused"}`}>
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
        </div>
    );
}
