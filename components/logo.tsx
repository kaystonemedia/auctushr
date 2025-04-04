import React from "react";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <div className={`flex items-center space-x-2 ${className || ''}`}>
      <div className="text-blue-500">
        <svg 
          width="32" 
          height="32" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M17 8C17 10.7614 14.7614 13 12 13C9.23858 13 7 10.7614 7 8C7 5.23858 9.23858 3 12 3C14.7614 3 17 5.23858 17 8Z" 
            fill="currentColor" 
          />
          <path 
            d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z" 
            fill="currentColor" 
          />
          <path 
            d="M17 8C17 10.7614 14.7614 13 12 13C9.23858 13 7 10.7614 7 8C7 5.23858 9.23858 3 12 3C14.7614 3 17 5.23858 17 8Z" 
            stroke="currentColor" 
            strokeWidth="2" 
          />
          <path 
            d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z" 
            stroke="currentColor" 
            strokeWidth="2" 
          />
        </svg>
      </div>
      <span className="text-xl font-bold">KayStoneMedia</span>
    </div>
  );
}
