"use client";

import Image from "next/image";
import Link from "next/link";
import type React from "react";
import { useState } from "react";

interface United24BannerProps {
  onClose?: () => void;
  showCloseButton?: boolean;
}

const United24Banner: React.FC<United24BannerProps> = ({ onClose, showCloseButton = true }) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  if (!isVisible) return null;

  const bannerClasses =
    "mb-6 w-full shadow-md relative z-50 overflow-hidden bg-[#ffd700] dark:bg-[#0057b7]";

  const buttonClasses =
    "banner-button bg-[#0057b7] dark:bg-[#ffd700] hover:bg-white dark:hover:bg-white text-[#ffd700] dark:text-blue-800 hover:text-[#0057b7] font-bold py-2 px-6 rounded uppercase shadow-md opacity-90 hover:opacity-100 transition-opacity duration-300";

  const textColorClasses = "text-blue-800 dark:text-white";

  return (
    <div aria-label="Support Ukraine banner" className={bannerClasses} role="banner">
      <div className="container mx-auto flex flex-col items-center justify-between px-4 py-4 md:flex-row">
        <div className="banner-content mb-4 flex flex-col items-center md:mb-0 md:flex-row">
          <div className="banner-logo relative mb-3 flex-shrink-0 md:mr-5 md:mb-0">
            {/* Use Image component with different sources based on theme */}
            <Image
              alt="United24 Logo"
              className="block h-auto w-24 rounded dark:hidden"
              height={48}
              priority
              src="/u24.svg"
              width={96}
            />
            <Image
              alt="United24 Logo"
              className="hidden h-auto w-24 rounded dark:block"
              height={48}
              priority
              src="/u24_white.svg"
              width={96}
            />
          </div>
          <p
            className={`banner-content text-center font-semibold md:text-left ${textColorClasses}`}
          >
            Stand with Ukraine. Help fund drones, medkits, and victory. Every dollar helps stop{" "}
            <Link
              className="underline"
              href="https://war.ukraine.ua/russia-war-crimes"
              rel="noopener noreferrer"
              target="_blank"
            >
              russia's war crimes
            </Link>{" "}
            and saves lives. It matters.
          </p>
        </div>

        <div className="banner-content flex items-center">
          <Link
            aria-label="Donate to support Ukraine"
            className={buttonClasses}
            href="https://u24.gov.ua"
            rel="noopener noreferrer"
            target="_blank"
          >
            Donate
          </Link>

          {showCloseButton && (
            <button
              aria-label="Close Ukraine support banner"
              className={`banner-content ml-4 opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current focus:ring-opacity-50 ${textColorClasses}`}
              onClick={handleClose}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <title>Close</title>
                <path
                  clipRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  fillRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default United24Banner;
