---
title: Building BiLSTM-CRF from Scratch Segmentation
date: 2026-04-05 18:05:00
categories: 
  - Tech
  - NLP
tags:
  - PyTorch
  - Deep Learning
  - BiLSTM-CRF
  
sticky: 100
---

> 本文提供中文版本。 
> [阅读简体中文版](bilstm-crf-from-scratch-cn.html)

---

Chinese word segmentation is the cornerstone of Natural Language Processing (NLP). I decided not to rely on the API of CRF++ or any high-level APIs. Instead, I built a model from scratch using Pytorch to handle low-level tensor operations.

Ultimately, this model achieved a **91.0% of F1 Score** on SIGHAN PKU!

This article documents the entire process of architecting the model from the ground up.


## 1.Transforming Language into Mathematics

Computers cannot comprehend Chinese characters directly, they exclusively process numerical data. So before feeding text into the model, we need to bridge the gap by digitizing the text.

### 1.1 Word Embedding


