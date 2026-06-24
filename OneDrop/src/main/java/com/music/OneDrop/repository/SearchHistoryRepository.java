package com.music.OneDrop.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.music.OneDrop.model.SearchHistoryEntry;

public interface SearchHistoryRepository extends JpaRepository<SearchHistoryEntry, Long> {

    // Last 10 entries for a given source, newest first
  // SearchHistoryRepository.java — remove the @Modifying JPQL, add this instead:

List<SearchHistoryEntry> findBySourceAndQueryIgnoreCase(String source, String query);

List<SearchHistoryEntry> findTop10BySourceOrderBySearchedAtDesc(String source);

long countBySource(String source);

List<SearchHistoryEntry> findBySourceOrderBySearchedAtAsc(String source);
}