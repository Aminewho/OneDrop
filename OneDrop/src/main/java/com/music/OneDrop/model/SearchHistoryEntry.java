package com.music.OneDrop.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "search_history")
public class SearchHistoryEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String source;  // "youtube" or "spotify"

    @Column(nullable = false)
    private String query;

    @Column(nullable = false)
    private LocalDateTime searchedAt;

    public SearchHistoryEntry() {}

    public SearchHistoryEntry(String source, String query) {
        this.source     = source;
        this.query      = query;
        this.searchedAt = LocalDateTime.now();
    }

    public Long          getId()         { return id; }
    public String        getSource()     { return source; }
    public String        getQuery()      { return query; }
    public LocalDateTime getSearchedAt() { return searchedAt; }
    public void          setSearchedAt(LocalDateTime t) { this.searchedAt = t; }
}