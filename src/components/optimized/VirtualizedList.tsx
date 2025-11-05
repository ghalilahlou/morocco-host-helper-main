import React, { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { FixedSizeList as List } from 'react-window';

interface VirtualizedListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (props: { index: number; style: React.CSSProperties; data: T }) => React.ReactNode;
  overscanCount?: number;
  className?: string;
}

// Composant d'élément mémorisé
const VirtualizedItem = memo<{
  index: number;
  style: React.CSSProperties;
  data: any;
  renderItem: (props: { index: number; style: React.CSSProperties; data: any }) => React.ReactNode;
}>(({ index, style, data, renderItem }) => {
  return (
    <div style={style}>
      {renderItem({ index, style, data })}
    </div>
  );
});

VirtualizedItem.displayName = 'VirtualizedItem';

// Composant de liste virtuelle optimisé
export const VirtualizedList = memo(<T,>({
  items,
  height,
  itemHeight,
  renderItem,
  overscanCount = 5,
  className = ''
}: VirtualizedListProps<T>) => {
  const listRef = useRef<List>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Gestion du scroll avec debouncing
  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, []);

  // Nettoyage du timeout
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Fonction de rendu d'élément mémorisée
  const itemRenderer = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    return (
      <VirtualizedItem
        index={index}
        style={style}
        data={items[index]}
        renderItem={renderItem}
      />
    );
  }, [items, renderItem]);

  return (
    <div className={`virtualized-list ${className}`}>
      <List
        ref={listRef}
        height={height}
        itemCount={items.length}
        itemSize={itemHeight}
        itemData={items}
        overscanCount={overscanCount}
        onScroll={handleScroll}
        className={isScrolling ? 'scrolling' : ''}
      >
        {itemRenderer}
      </List>
    </div>
  );
}) as <T>(props: VirtualizedListProps<T>) => React.ReactElement;

VirtualizedList.displayName = 'VirtualizedList';

// Hook pour la gestion de la liste virtuelle
export const useVirtualizedList = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [scrollTop, setScrollTop] = useState(0);

  const visibleItems = useMemo(() => {
    const start = Math.max(0, visibleRange.start - 5); // Buffer
    const end = Math.min(items.length, visibleRange.end + 5); // Buffer
    return items.slice(start, end);
  }, [items, visibleRange]);

  const handleScroll = useCallback((scrollTop: number) => {
    setScrollTop(scrollTop);
    
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    );
    
    setVisibleRange({ start, end });
  }, [itemHeight, containerHeight, items.length]);

  const scrollToIndex = useCallback((index: number) => {
    const scrollTop = index * itemHeight;
    setScrollTop(scrollTop);
    handleScroll(scrollTop);
  }, [itemHeight, handleScroll]);

  return {
    visibleItems,
    scrollTop,
    handleScroll,
    scrollToIndex,
    totalHeight: items.length * itemHeight
  };
};

// Composant de liste horizontale virtuelle
export const VirtualizedHorizontalList = memo(<T,>({
  items,
  width,
  itemWidth,
  renderItem,
  overscanCount = 5,
  className = ''
}: Omit<VirtualizedListProps<T>, 'height' | 'itemHeight'> & {
  width: number;
  itemWidth: number;
}) => {
  const itemRenderer = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    return (
      <VirtualizedItem
        index={index}
        style={style}
        data={items[index]}
        renderItem={renderItem}
      />
    );
  }, [items, renderItem]);

  return (
    <div className={`virtualized-horizontal-list ${className}`}>
      <List
        height={200} // Hauteur fixe pour la liste horizontale
        itemCount={items.length}
        itemSize={itemWidth}
        itemData={items}
        overscanCount={overscanCount}
        layout="horizontal"
      >
        {itemRenderer}
      </List>
    </div>
  );
}) as <T>(props: Omit<VirtualizedListProps<T>, 'height' | 'itemHeight'> & {
  width: number;
  itemWidth: number;
}) => React.ReactElement;

VirtualizedHorizontalList.displayName = 'VirtualizedHorizontalList';

