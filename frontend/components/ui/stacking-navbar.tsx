"use client"

import Link from "next/link";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { HomeIcon, LineChart, Newspaper } from "lucide-react";

const StackingNavbar = () => {
  const [expanded, setExpanded] = useState(false);

  const items = [
    { href: "#", label: "Home", icon: <HomeIcon className="w-5 h-5 mr-2" /> },
    { href: "#", label: "Analytics", icon: <LineChart className="w-5 h-5 mr-2" /> },
    { href: "#", label: "News", icon: <Newspaper className="w-5 h-5 mr-2" /> },
  ];

  return (
    <div
      className="fixed left-1/2 top-6 -translate-x-1/2 flex items-center gap-x-3 z-50"
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
}: {
  href: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  expanded: boolean;
  index: number;
  icon?: React.ReactNode;
}) => {
  return (
    <motion.div
      initial={{ x: -100 * index }}
      animate={{ x: expanded ? 0 : -100 * index }}
      transition={{
        duration: 0.6,
        ease: "circInOut",
        delay: 0.1 * index,
        type: "spring",
      }}
      style={{ zIndex: 100 - index }}
    >
      <Link
        className="flex items-center text-base px-6 py-3.5 rounded-3xl bg-white/20 no-underline text-black backdrop-blur-lg hover:bg-black/80 hover:text-white transition-colors duration-300 ease-in-out"
        href={href}
        style={style}
      >
        {icon}
        {children}
      </Link>
    </motion.div>
  );
};

export { StackingNavbar }; 