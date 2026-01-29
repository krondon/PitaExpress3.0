"use client";

import React from "react";

export default function VideoBackground() {
    return (
        <div className="video-background">
            <video autoPlay muted loop playsInline>
                <source src="/videos/127303-738105472_medium.mp4" type="video/mp4" />
            </video>
        </div>
    );
}
