"use client"

import Link from "next/link";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { HomeIcon, LineChart, Newspaper } from "lucide-react";

const StackingNavbar = () => {
  const [expanded, setExpanded] = useState(false);

  const items = [
    { href: "/", label: "Home", icon: <HomeIcon className="w-5 h-5 mr-2" /> },
    { href: "#analytics", label: "Analytics", icon: <LineChart className="w-5 h-5 mr-2" /> },
    { href: "#news", label: "News", icon: <Newspaper className="w-5 h-5 mr-2" /> },
  ];

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    if (href === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <div
      className="fixed left-1/2 top-6 -translate-x-1/2 flex items-center justify-center gap-x-3 z-50"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {items.map((item, index) => (
        <StackingNavbarItem
          href={item.href}
          expanded={expanded}
          key={index}
          index={index}
          icon={item.icon}
          onClick={(e) => handleClick(e, item.href)}
        >
          {item.label}
        </StackingNavbarItem>
      ))}
    </div>
  );
};

const StackingNavbarItem = ({
  href,
  children,
  style,
  expanded,
  index,
  icon,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  expanded: boolean;
  index: number;
  icon?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) => {
  const isCenter = index === 1;
  const translateX = expanded ? 0 : isCenter ? 0 : -100 * (index - 1);

  return (
    <motion.div
      initial={{ x: translateX }}
      animate={{ x: translateX }}
      transition={{
        ease: "circInOut",
        delay: 0.1 * index,
        type: "spring",
      }}
      style={{ zIndex: 100 - index }}
    >
      <Link
        className="flex items-center text-base px-6 py-3.5 rounded-3xl bg-white/20 no-underline text-black backdrop-blur-lg hover:bg-black/80 hover:text-white transition-colors duration-300 ease-in-out font-inter"
        href={href}
        style={style}
        onClick={onClick}
      >
        {icon}
        {children}
      </Link>
    </motion.div>
  );
};

export { StackingNavbar }; 