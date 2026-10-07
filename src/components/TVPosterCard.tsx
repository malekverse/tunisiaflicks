"use client"
import React from 'react'
import PosterCard, { SkeletonLoader, type PosterCardProps } from './PosterCard'

export { SkeletonLoader }

export default function TVPosterCard(props: Omit<PosterCardProps, 'mediaType'>) {
    return <PosterCard {...props} mediaType="tv" />
}
